const express = require('express');
const router = express.Router();
const Invitation = require('../models/Invitation');
const event = require('../config/event');

function anyoneAttending(invitation) {
  const memberAttending = invitation.members.some((m) => m.attending === true);
  const plusOneAttending = invitation.allowPlusOne && invitation.plusOneAttending;
  return memberAttending || plusOneAttending;
}

// Pagina principal, sin token: instrucciones genericas
router.get('/', (req, res) => {
  res.render('home', { event });
});

// Invitacion personal / familiar
router.get('/i/:token', async (req, res) => {
  const invitation = await Invitation.findOne({ token: req.params.token });
  if (!invitation) {
    return res.status(404).render('not-found', { event });
  }
  res.render('invitation', {
    event,
    invitation,
    anyoneAttending: anyoneAttending(invitation),
    error: null,
    submitted: req.query.submitted === '1',
  });
});

// Enviar RSVP
router.post('/i/:token/rsvp', async (req, res) => {
  const invitation = await Invitation.findOne({ token: req.params.token });
  if (!invitation) {
    return res.status(404).render('not-found', { event });
  }

  const { plusOneAttending, plusOneName, notes, phoneConfirmed, phoneCorrection } = req.body;

  let allAnswered = true;
  invitation.members.forEach((member, i) => {
    const value = req.body[`member_${i}`];
    if (value === 'yes') member.attending = true;
    else if (value === 'no') member.attending = false;
    else allAnswered = false;
  });

  if (!allAnswered) {
    return res.status(400).render('invitation', {
      event,
      invitation,
      anyoneAttending: anyoneAttending(invitation),
      error: 'Indica si cada persona asistirá o no.',
      submitted: false,
    });
  }

  if (invitation.allowPlusOne) {
    invitation.plusOneAttending = plusOneAttending === 'yes';
    invitation.plusOneName = invitation.plusOneAttending ? (plusOneName || '').trim() : '';
  }

  const correction = (phoneCorrection || '').trim();
  if (correction && correction !== invitation.phone) {
    invitation.phone = correction;
    invitation.phoneConfirmed = true;
  } else if (invitation.phone) {
    invitation.phoneConfirmed = phoneConfirmed === 'yes';
  }

  invitation.notes = (notes || '').trim();
  invitation.status = 'responded';
  invitation.respondedAt = new Date();

  await invitation.save();

  res.redirect(`/i/${invitation.token}?submitted=1`);
});

module.exports = router;
