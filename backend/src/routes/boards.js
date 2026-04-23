const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const auth = require('../middleware/auth');

router.get('/my', auth, async (req, res) => {
  const boards = await prisma.board.findMany({ where: { ownerId: req.user.id } });
  res.json(boards);
});

router.post('/', auth, async (req, res) => {
  const body = req.body || {};
  const { name, slug, description } = body;
  if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
  try {
    const board = await prisma.board.create({
      data: { name, slug, description: description || null, ownerId: req.user.id }
    });
    res.json(board);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Slug taken' });
  }
});

router.get('/:slug', async (req, res) => {
  const board = await prisma.board.findUnique({ where: { slug: req.params.slug } });
  if (!board) return res.status(404).json({ error: 'Not found' });
  res.json(board);
});

router.patch('/:slug/settings', auth, async (req, res) => {
  const board = await prisma.board.findUnique({ where: { slug: req.params.slug } });
  if (!board) return res.status(404).json({ error: 'Not found' });
  if (board.ownerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
  const updated = await prisma.board.update({ where: { slug: req.params.slug }, data: req.body });
  res.json(updated);
});

const postRouter = express.Router({ mergeParams: true });
router.use('/:slug/posts', postRouter);

postRouter.get('/', async (req, res) => {
  const board = await prisma.board.findUnique({ where: { slug: req.params.slug } });
  if (!board) return res.status(404).json({ error: 'Board not found' });
  const posts = await prisma.post.findMany({ where: { boardId: board.id }, orderBy: { createdAt: 'desc' } });
  res.json(posts);
});

postRouter.post('/', async (req, res) => {
  const board = await prisma.board.findUnique({ where: { slug: req.params.slug } });
  if (!board) return res.status(404).json({ error: 'Board not found' });
  const post = await prisma.post.create({
    data: { 
      title: req.body.title, 
      content: req.body.content, 
      tags: JSON.stringify(req.body.tags || []), 
      status: req.body.status || 'Stand By',
      boardId: board.id 
    }
  });
  res.json(post);
});

postRouter.get('/:id', async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

postRouter.patch('/:id/status', auth, async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const board = await prisma.board.findUnique({ where: { id: post.boardId } });
  if (board.ownerId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
  const updated = await prisma.post.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  res.json(updated);
});

postRouter.post('/:id/upvote', async (req, res) => {
  await prisma.upvote.create({ data: { postId: req.params.id, fingerprint: req.body.fingerprint } });
  res.json({ upvoted: true });
});

postRouter.post('/:id/comments', async (req, res) => {
  const comment = await prisma.comment.create({ data: { content: req.body.content, postId: req.params.id } });
  res.json(comment);
});

module.exports = router;