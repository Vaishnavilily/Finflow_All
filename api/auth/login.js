// api/auth/login.js  — Finflow_All / Gateway
//
// Fix: removed the broken jwt.sign call with "name: ..." placeholder.
// The response now returns user: { id, email, firstName, lastName }
// so the frontend redirectSuccess() can build the authUser object correctly.

import { getDb } from '../_lib/db.js';
import bcrypt from 'bcryptjs';

function resolveUserCollectionName(userType) {
  if (userType === 'individual') return 'individual_users';
  if (userType === 'sme') return 'sme_users';
  return null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, userType } = req.body || {};

  if (!email || !password || !userType) {
    return res.status(400).json({ success: false, message: 'Email, password and account type are required.' });
  }

  const collectionName = resolveUserCollectionName(userType);
  if (!collectionName) {
    return res.status(400).json({ success: false, message: 'Invalid account type.' });
  }

  try {
    const db = await getDb();
    const user = await db.collection(collectionName).findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // ✅ Return user data — the frontend uses this to build authUser and pass authId to the personal app
    return res.status(200).json({
      success: true,
      userType,
      user: {
        id: user._id.toString(),          // ← this becomes authId in the personal app
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
}