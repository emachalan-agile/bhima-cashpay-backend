import express from "express";
import pkg from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { Cashfree, CFEnvironment } from "cashfree-pg";

const app = express();
const { json } = pkg;
app.use(cors());
app.use(json());
dotenv.config();

// Initialise Cashfree SDK with credentials
const cashfree = new Cashfree(
  CFEnvironment.SANDBOX, // Change to PRODUCTION when live
  process.env.CASHFREE_APP_ID,
  process.env.CASHFREE_SECRET_KEY
);

// ========================= SMS SERVICE FUNCTION =========================
const sendOtpService = async (name, number, otp) => {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  
  let numPayload = {
    "international": "NO",
    "countrycode": "91",
    "number": `91${number}`,
    "message": `Dear ${name} Your Login OTP for BHIMA e-Gold is ${otp}, Thank you for choosing BHIMA e-Gold.`,
    "url": ""
  };
  
  const raw = JSON.stringify({
    "api": "d30caef1a8d9a782b1a19520b20f9db6",
    "senderid": "MBHIMA",
    "campaignid": "otpdemo",
    "channel": "otp",
    "templateid": "1707175594369642666",
    "dcs": "0",
    "shorturl": "NO",
    "dlr": "NO",
    "data": [
      { ...numPayload }
    ]
  });
  
  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: raw,
    redirect: "follow"
  };
  
  return await fetch("https://sms.versatilesmshub.com/api/smsservices.php", requestOptions)
    .then((response) => response.json())
    .then((result) => result)
    .catch((error) => error);
};

app.get("/", async (req, res) => {
  res.status(200).json({ message: "welcome to cashpay" });
});

// First /send-sms endpoint removed to fix duplication issue
// ========================= CREATE ORDER ENDPOINT =========================
app.post("/create-order", async (req, res) => {
  console.log("API /create-order called");
  try {
    const { order_amount, customer_id, customer_email, customer_phone } = req.body;

    if (!order_amount || !customer_id || !customer_email || !customer_phone) {
      return res.status(400).json({
        error: "Missing required fields: order_amount, customer_id, customer_email, customer_phone",
      });
    }

    const orderPayload = {
      order_amount: order_amount,
      order_currency: "INR",
      customer_details: {
        customer_id,
        customer_email,
        customer_phone,
      },
      order_meta: {
        return_url: `https://test.cashfree.com/pgappsdemos/return.php?order_id={order_id}`,
      },
    };

    const response = await cashfree.PGCreateOrder(orderPayload);

    // return Cashfree response to frontend
    res.json({
      success: true,
      order_id: response.data.order_id,
      payment_session_id: response.data.payment_session_id,
    });
  } catch (error) {
    console.error("Error creating order:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// ========================= VERIFY PAYMENT ENDPOINT =========================
app.post("/verify-payment", async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: "order_id is required for verification" });
    }

    const paymentStatusResponse = await cashfree.PGPaymentStatus(order_id);
    const paymentInfo = paymentStatusResponse.data;

    res.json({
      order_id: order_id,
      payment_status: paymentInfo.tx_status,
      payment_message: paymentInfo.tx_msg,
      payment_details: paymentInfo,
    });
  } catch (error) {
    console.error("Error verifying payment:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

// ========================= SEND SMS ENDPOINT =========================
app.post("/send-sms", async (req, res) => {
  console.log("API /send-sms called");
  try {
    const { name, number, otp } = req.body;

    // Validate required fields
    if (!name || !number || !otp) {
      return res.status(400).json({
        error: "Missing required fields: name, number, otp",
      });
    }

    // Validate phone number format (should be 10 digits)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(number)) {
      return res.status(400).json({
        error: "Invalid phone number format. Please provide a valid 10-digit Indian mobile number.",
      });
    }

    // Validate OTP format (should be numeric and 4-6 digits)
    const otpRegex = /^\d{4,6}$/;
    if (!otpRegex.test(otp)) {
      return res.status(400).json({
        error: "Invalid OTP format. OTP should be 4-6 digits.",
      });
    }

    // Call the SMS service
    const smsResponse = await sendOtpService(name, number, otp);

    // Check if SMS was sent successfully
    // The SMS service returns code "000" for success
    if (smsResponse && (
        smsResponse.code === "200" || 
        smsResponse.code === "000" || 
        (smsResponse.response && smsResponse.response.code === "000")
    )) {
      // Always return success with status 200 when SMS is sent successfully
      return res.status(200).json({
        success: true,
        message: "SMS sent successfully",
        jobId: smsResponse.jobId || (smsResponse.response && smsResponse.response.jobId),
        response: smsResponse.response || smsResponse,
      });
    } else {
      console.error("SMS service error:", smsResponse);
      // Return error response
      return res.status(500).json({
        success: false,
        error: "Failed to send SMS",
        details: smsResponse?.message || (smsResponse?.response?.message) || "Unknown error occurred",
        response: smsResponse.response || smsResponse,
      });
    }
  } catch (error) {
    console.error("Error sending SMS:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error while sending SMS",
      details: error.message,
    });
  }
});

// ========================= SERVER START =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cashfree backend running on http://localhost:${PORT}`);
});
