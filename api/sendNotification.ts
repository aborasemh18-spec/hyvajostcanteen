import admin from "firebase-admin";
import { createClient } from "@supabase/supabase-js";

// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Firebase Admin environment variables are missing.");
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    console.log("Firebase Admin initialized successfully.");
  }
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed",
    });
  }

  try {
    const { token, title, body, data } = req.body ?? {};

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "FCM token is required.",
      });
    }

    const message: admin.messaging.Message = {
      token,
    
      data: {
        title: String(title || "Hyva Canteen"),
        body: String(body || "Notification"),
      
        notification_type: String(data?.notification_type || "default"),
      
        couponType: String(data?.couponType || ""),
      
        employeeId: String(data?.employeeId || ""),
      
        couponId: String(data?.couponId || ""),
      
        requestId: String(data?.requestId || "")
      },
    
      android: {
        priority: "high"
      },
    
      apns: {
        payload: {
          aps: {
            contentAvailable: true
          }
        }
      }
    
    };
    console.log("Token received by API:", token);
    
    console.log("Sending notification...");
    console.log(JSON.stringify(message, null, 2));
    const messageId = await admin.messaging().send(message);

    console.log("Notification sent:", messageId);

    return res.status(200).json({
      success: true,
      messageId,
    });

  } catch (err: any) {

    console.error("FCM Error:", err);
  
    const errorCode = err?.errorInfo?.code || err?.code;
  
    if (
      errorCode === "messaging/registration-token-not-registered" ||
      errorCode === "messaging/invalid-registration-token"
    ) {
  
      try {
  
        const supabase = createClient(
          process.env.SUPABASE_URL || "https://culbxpuidvkimziokubl.supabase.co",
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_oumvFAgsYw-_v9DSyedYLA_uXXYh9NJ"
        );
  
        // We look up by fcmToken (or fcm_token) based on the instruction "Read employee fcm_token from Supabase."
        // We'll update both just in case, but let's assume the column is fcm_token.
        await supabase
          .from("employees")
          .update({ fcm_token: null })
          .eq("fcm_token", req.body.token);
  
        console.log("Invalid FCM token removed.");
  
      } catch (cleanupError) {
  
        console.error("Token cleanup failed:", cleanupError);
  
      }
  
      return res.status(410).json({
        success: false,
        error: "Invalid FCM token"
      });
  
    }
  
    return res.status(500).json({
      success: false,
      error: err?.message || "Internal Server Error",
    });
  
  }
}