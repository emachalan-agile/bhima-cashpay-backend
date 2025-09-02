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

// ========================= SERVER START =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Cashfree backend running on http://localhost:${PORT}`);
});
