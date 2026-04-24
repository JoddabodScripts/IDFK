const express = require('express');
const router = express.Router();
const { getDb } = require('../lib/firebase');
const auth = require('../middleware/auth');

router.get('/my', auth, async (req, res) => {
  const db = getDb();
  const boardsRef = db.collection('boards');
  const snapshot = await boardsRef.where('ownerId', '==', req.user.id).get();
  const boards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  res.json(boards);
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, slug, description } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'name and slug required' });
    
    const db = getDb();
    const boardsRef = db.collection('boards');
    
    const existing = await boardsRef.where('slug', '==', slug).limit(1).get();
    if (!existing.empty) {
      return res.status(400).json({ error: 'Slug taken' });
    }
    
    const boardRef = boardsRef.doc();
    await boardRef.set({
      name,
      slug,
      description: description || null,
      brandingConfig: JSON.stringify({
        accentColor: '#6366f1',
        logo: '',
        statuses: ['Stand By', 'Planned', 'In Progress', 'Done', 'Rejected'],
        tags: [],
        requireAuth: false,
        allowAnonymousUpvotes: true,
      }),
      ownerId: req.user.id,
      createdAt: new Date().toISOString(),
    });
    
    const board = { id: boardRef.id, name, slug, description, brandingConfig: '{}', ownerId: req.user.id };
    res.json(board);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const db = getDb();
    const boardsRef = db.collection('boards');
    const snapshot = await boardsRef.where('slug', '==', req.params.slug).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const board = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    res.json(board);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:slug/settings', auth, async (req, res) => {
  try {
    const db = getDb();
    const boardsRef = db.collection('boards');
    const snapshot = await boardsRef.where('slug', '==', req.params.slug).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const boardDoc = snapshot.docs[0];
    const board = { id: boardDoc.id, ...boardDoc.data() };
    
    if (board.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await boardDoc.ref.update(req.body);
    const updated = { id: boardDoc.id, ...boardDoc.data(), ...req.body };
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

const postRouter = express.Router({ mergeParams: true });
router.use('/:slug/posts', postRouter);

postRouter.get('/', async (req, res) => {
  try {
    const db = getDb();
    const boardsRef = db.collection('boards');
    const snapshot = await boardsRef.where('slug', '==', req.params.slug).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    const boardId = snapshot.docs[0].id;
    const postsRef = db.collection('posts');
    const postsSnapshot = await postsRef.where('boardId', '==', boardId).get();
    let posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

postRouter.post('/', async (req, res) => {
  try {
    const db = getDb();
    const boardsRef = db.collection('boards');
    const snapshot = await boardsRef.where('slug', '==', req.params.slug).limit(1).get();
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    const boardId = snapshot.docs[0].id;
    const postsRef = db.collection('posts');
    const postRef = postsRef.doc();
    
    let userId = null;
    if (req.headers.authorization && req.user) {
      userId = req.user.id;
    }
    
    await postRef.set({
      title: req.body.title,
      content: req.body.content,
      tags: JSON.stringify(req.body.tags || []),
      status: 'Stand By',
      boardId,
      userId,
      createdAt: new Date().toISOString(),
    });
    
    const post = { id: postRef.id, title: req.body.title, content: req.body.content, tags: '[]', status: 'Stand By', boardId, userId };
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

postRouter.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const postsRef = db.collection('posts');
    const postDoc = await postsRef.doc(req.params.id).get();
    
    if (!postDoc.exists) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const post = { id: postDoc.id, ...postDoc.data() };
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

postRouter.patch('/:id/status', auth, async (req, res) => {
  try {
    const db = getDb();
    const postsRef = db.collection('posts');
    const postDoc = await postsRef.doc(req.params.id).get();
    
    if (!postDoc.exists) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const post = { id: postDoc.id, ...postDoc.data() };
    
    const boardsRef = db.collection('boards');
    const boardSnapshot = await boardsRef.doc(post.boardId).get();
    const board = { id: boardSnapshot.id, ...boardSnapshot.data() };
    
    if (board.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await postDoc.ref.update({ status: req.body.status });
    const updated = { id: postDoc.id, ...postDoc.data(), status: req.body.status };
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

postRouter.post('/:id/upvote', async (req, res) => {
  try {
    const db = getDb();
    const upvotesRef = db.collection('upvotes');
    const fingerprint = req.body.fingerprint;
    
    const existing = await upvotesRef.where('postId', '==', req.params.id)
      .where('fingerprint', '==', fingerprint)
      .limit(1)
      .get();
    
    if (!existing.empty) {
      return res.json({ upvoted: true, already: true });
    }
    
    await upvotesRef.add({
      postId: req.params.id,
      fingerprint,
      createdAt: new Date().toISOString(),
    });
    
    const postsRef = db.collection('posts');
    const postDoc = await postsRef.doc(req.params.id).get();
    if (postDoc.exists) {
      const current = postDoc.data().upvotes || 0;
      await postDoc.ref.update({ upvotes: current + 1 });
    }
    
    res.json({ upvoted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

postRouter.get('/:id/comments', async (req, res) => {
  try {
    const db = getDb();
    const commentsRef = db.collection('comments');
    const snapshot = await commentsRef.where('postId', '==', req.params.id).get();
    const comments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

postRouter.post('/:id/comments', async (req, res) => {
  try {
    const db = getDb();
    const commentsRef = db.collection('comments');
    const commentRef = commentsRef.doc();
    await commentRef.set({
      content: req.body.content,
      postId: req.params.id,
      createdAt: new Date().toISOString(),
    });
    res.json({ id: commentRef.id, content: req.body.content, postId: req.params.id, createdAt: new Date().toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

postRouter.delete('/:id', auth, async (req, res) => {
  try {
    const db = getDb();
    const postsRef = db.collection('posts');
    const postDoc = await postsRef.doc(req.params.id).get();
    
    if (!postDoc.exists) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    const post = postDoc.data();
    
    const boardsRef = db.collection('boards');
    const boardSnapshot = await boardsRef.doc(post.boardId).get();
    const board = boardSnapshot.data();
    
    if (board.ownerId !== req.user.id && post.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    await postsRef.doc(req.params.id).delete();
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;