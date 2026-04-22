const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const auth = require('../middleware/auth');

// Get user's boards
router.get('/my', auth, async (req, res) => {
  const boards = await prisma.board.findMany({
    where: { ownerId: req.user.id },
    include: { _count: { select: { posts: true } } },
  });
  res.json(boards);
});

// Create board
router.post('/', auth, async (req, res) => {
  const { name, slug, description } = req.body;
  try {
    const board = await prisma.board.create({
      data: { name, slug, description, ownerId: req.user.id },
    });
    res.json(board);
  } catch (err) {
    res.status(400).json({ error: 'Slug already taken' });
  }
});

// Get board branding
router.get('/:slug', async (req, res) => {
  const board = await prisma.board.findUnique({
    where: { slug: req.params.slug },
  });
  if (!board) return res.status(404).json({ error: 'Board not found' });
  res.json(board);
});

// Update settings
router.patch('/:slug/settings', auth, async (req, res) => {
  const { name, description, brandingConfig } = req.body;
  const board = await prisma.board.findUnique({ where: { slug: req.params.slug } });
  if (board.ownerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

  const updated = await prisma.board.update({
    where: { slug: req.params.slug },
    data: { name, description, brandingConfig },
  });
  res.json(updated);
});

// Post routes nested under /boards/:slug/posts
const postRouter = express.Router({ mergeParams: true });
router.use('/:slug/posts', postRouter);

// List posts
postRouter.get('/', async (req, res) => {
  const { status, sort } = req.query;
  const board = await prisma.board.findUnique({ where: { slug: req.params.slug } });
  if (!board) return res.status(404).json({ error: 'Board not found' });

  let orderBy = { createdAt: 'desc' };
  if (sort === 'votes') orderBy = { upvotes: { _count: 'desc' } };

  const posts = await prisma.post.findMany({
    where: {
      boardId: board.id,
      ...(status && { status }),
    },
    include: {
      _count: { select: { upvotes: true, comments: true } },
      author: { select: { email: true } },
    },
    orderBy,
  });
  res.json(posts);
});

// Submit post
postRouter.post('/', async (req, res) => {
  const { title, content, tags } = req.body;
  const board = await prisma.board.findUnique({ where: { slug: req.params.slug } });
  if (!board) return res.status(404).json({ error: 'Board not found' });

  // Optional auth
  let authorId = null;
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    try {
      const verified = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'secret');
      authorId = verified.id;
    } catch (e) {}
  }

  if (board.brandingConfig.requireAuth && !authorId) {
    return res.status(401).json({ error: 'Auth required' });
  }

  const post = await prisma.post.create({
    data: { title, content, tags, boardId: board.id, authorId },
  });
  res.json(post);
});

// Toggle upvote
postRouter.post('/:id/upvote', async (req, res) => {
  const { fingerprint } = req.body;
  const postId = req.params.id;

  let userId = null;
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    try {
      const verified = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'secret');
      userId = verified.id;
    } catch (e) {}
  }

  const board = await prisma.board.findFirst({
    where: { posts: { some: { id: postId } } }
  });
  
  if (!userId && (!fingerprint || !board.brandingConfig.allowAnonymousUpvotes)) {
    return res.status(401).json({ error: 'Auth or fingerprint required' });
  }

  const existing = await prisma.upvote.findFirst({
    where: {
      postId,
      OR: [
        ...(userId ? [{ userId }] : []),
        ...(fingerprint ? [{ fingerprint }] : []),
      ],
    },
  });

  if (existing) {
    await prisma.upvote.delete({ where: { id: existing.id } });
    res.json({ upvoted: false });
  } else {
    await prisma.upvote.create({
      data: { postId, userId, fingerprint },
    });
    res.json({ upvoted: true });
  }
});

// Add comment
postRouter.post('/:id/comments', async (req, res) => {
  const { content } = req.body;
  let authorId = null;
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (token) {
    try {
      const verified = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'secret');
      authorId = verified.id;
    } catch (e) {}
  }

  const comment = await prisma.comment.create({
    data: { content, postId: req.params.id, authorId },
  });
  res.json(comment);
});

// Get single post with comments
postRouter.get('/:id', async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { upvotes: true, comments: true } },
      author: { select: { email: true } },
      comments: { include: { author: { select: { email: true } } } },
    },
  });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// Update post (owner only)
postRouter.patch('/:id', auth, async (req, res) => {
  const { status, title, content } = req.body;
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: { board: true },
  });
  if (post.board.ownerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

  const updated = await prisma.post.update({
    where: { id: req.params.id },
    data: { status, title, content },
  });
  res.json(updated);
});

// Delete post (owner only)
postRouter.delete('/:id', auth, async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id },
    include: { board: true },
  });
  if (post.board.ownerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

  await prisma.post.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;
