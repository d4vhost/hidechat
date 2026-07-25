import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';

export async function POST(req: Request) {
  try {
    const { qrValue, idToken } = await req.json();

    if (!qrValue || !idToken) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    
    const admin = getFirebaseAdmin();
    if (!admin.apps.length) {
      return NextResponse.json({ error: 'Server misconfiguration: Firebase Admin not initialized.' }, { status: 500 });
    }
    const adminAuth = admin.auth();
    const adminDb = admin.firestore();

    // Verify the caller's ID token to ensure they are a legitimate logged-in user
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Create a Custom Token for this user so the new device can log in without SMS
    const customToken = await adminAuth.createCustomToken(uid);

    // Save the token securely in the QR session document
    await adminDb.collection('qr_sessions').doc(qrValue).set({
      authorized: true,
      authorizingUid: uid,
      token: customToken,
      timestamp: new Date()
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('QR Sync API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
