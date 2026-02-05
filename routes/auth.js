const express = require('express');
const router = express.Router();
const { auth, dbFirestore } = require('../config/db');

router.put('/api/users/:uid/password', async (req, res) => {
  const { uid } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ success: false, message: 'New password is required.' });
  }

  try {
    await auth.updateUser(uid, { password: newPassword });
    const userDocRef = dbFirestore.collection('customers').doc(uid);
    const docSnapshot = await userDocRef.get();
    
    if (!docSnapshot.exists) {
      return res.status(404).json({ success: false, message: 'User document not found in Firestore.' });
    }

    await userDocRef.update({ password: newPassword });
    return res.status(200).json({ success: true, message: 'Password updated in Firebase Auth and Firestore.' });
  } catch (error) {
    console.error('Error updating password:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update password.',
      error: error.message
    });
  }
});

router.get('/get-uid-by-email', async (req, res) => {
  const { email } = req.query;
  try {
    const userRecord = await auth.getUserByEmail(email);
    res.status(200).json({ success: true, uid: userRecord.uid });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(404).json({ success: false, message: 'User not found' });
  }
});

module.exports = router;