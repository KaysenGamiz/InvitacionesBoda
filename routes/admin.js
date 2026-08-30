const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const Invitation = require('../models/Invitation');
const requireAdmin = require('../middleware/auth');

router.get('/login', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin');
  }
  res.render('admin-login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin');
  }
  res.status(401).render('admin-login', { error: 'Usuario o contraseña incorrectos.' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.use(requireAdmin);

router.get('/', async (req, res) => {
  const invitations = await Invitation.find().sort({ createdAt: -1 });

  const stats = {
    totalInvitations: invitations.length,
    responded: invitations.filter((inv) => inv.status === 'responded').length,
    pending: invitations.filter((inv) => inv.status === 'pending').length,
    totalInvited: invitations.reduce((sum, inv) => sum + inv.members.length + (inv.allowPlusOne ? 1 : 0), 0),
    headcount: invitations.reduce((sum, inv) => {
      const membersAttending = inv.members.filter((m) => m.attending === true).length;
      const plusOne = inv.allowPlusOne && inv.plusOneAttending ? 1 : 0;
      return sum + membersAttending + plusOne;
    }, 0),
  };

  res.render('admin-dashboard', { invitations, stats, baseUrl: process.env.BASE_URL || '' });
});

// Convierte el textarea de miembros (un nombre por linea) en un array,
// conservando el estado "attending" de los que ya existian con ese mismo nombre.
function parseMembers(rawText, existingMembers) {
  const existingByName = new Map((existingMembers || []).map((m) => [m.name.trim().toLowerCase(), m]));
  return String(rawText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => {
      const previous = existingByName.get(name.toLowerCase());
      return { name, attending: previous ? previous.attending : null };
    });
}

router.get('/guests/new', (req, res) => {
  res.render('admin-guest-form', { invitation: null });
});

router.post('/guests', async (req, res) => {
  const { familyName, membersText, allowPlusOne, phone } = req.body;
  const members = parseMembers(membersText, []);
  if (members.length === 0) {
    return res.status(400).render('admin-guest-form', {
      invitation: { familyName, members: [], allowPlusOne: allowPlusOne === 'on', phone },
      error: 'Agrega al menos un nombre.',
    });
  }
  await Invitation.create({
    familyName: (familyName || '').trim(),
    members,
    allowPlusOne: allowPlusOne === 'on',
    phone: (phone || '').trim(),
    token: nanoid(10),
  });
  res.redirect('/admin');
});

router.get('/guests/:id/edit', async (req, res) => {
  const invitation = await Invitation.findById(req.params.id);
  if (!invitation) return res.redirect('/admin');
  const otherInvitations = await Invitation.find({ _id: { $ne: invitation._id } }).sort({
    'members.0.name': 1,
  });
  res.render('admin-guest-form', { invitation, error: null, otherInvitations });
});

router.post('/guests/:id', async (req, res) => {
  const { familyName, membersText, allowPlusOne, phone } = req.body;
  const invitation = await Invitation.findById(req.params.id);
  if (!invitation) return res.redirect('/admin');

  const members = parseMembers(membersText, invitation.members);
  if (members.length === 0) {
    return res.status(400).render('admin-guest-form', {
      invitation: { ...invitation.toObject(), familyName, members: [], phone },
      error: 'Agrega al menos un nombre.',
    });
  }

  const trimmedPhone = (phone || '').trim();
  if (trimmedPhone !== invitation.phone) {
    invitation.phone = trimmedPhone;
    invitation.phoneConfirmed = false;
  }
  invitation.familyName = (familyName || '').trim();
  invitation.members = members;
  invitation.allowPlusOne = allowPlusOne === 'on';
  await invitation.save();

  res.redirect('/admin');
});

// Une los miembros de otra invitacion existente (sourceId) a esta invitacion
// grupal y borra la invitacion origen, que ya queda absorbida en el grupo.
router.post('/guests/:id/merge', async (req, res) => {
  const { sourceId } = req.body;
  const target = await Invitation.findById(req.params.id);
  const source = sourceId ? await Invitation.findById(sourceId) : null;

  if (!target) return res.redirect('/admin');
  if (!source || String(source._id) === String(target._id)) {
    return res.redirect(`/admin/guests/${target._id}/edit`);
  }

  const existingNames = new Set(target.members.map((m) => m.name.trim().toLowerCase()));
  source.members.forEach((m) => {
    const key = m.name.trim().toLowerCase();
    if (!existingNames.has(key)) {
      target.members.push({ name: m.name, attending: m.attending });
      existingNames.add(key);
    }
  });
  target.allowPlusOne = target.allowPlusOne || source.allowPlusOne;
  if (!target.phone && source.phone) {
    target.phone = source.phone;
    target.phoneConfirmed = source.phoneConfirmed;
  }

  await target.save();
  await Invitation.findByIdAndDelete(source._id);

  res.redirect(`/admin/guests/${target._id}/edit`);
});

router.post('/guests/:id/sent', async (req, res) => {
  const invitation = await Invitation.findById(req.params.id);
  if (!invitation) return res.status(404).json({ error: 'No encontrada' });
  invitation.invitationSent = req.body.sent === 'true';
  await invitation.save();
  res.json({ ok: true, invitationSent: invitation.invitationSent });
});

router.post('/guests/:id/delete', async (req, res) => {
  await Invitation.findByIdAndDelete(req.params.id);
  res.redirect('/admin');
});

module.exports = router;
