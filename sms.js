// ========================= SMS MODULE =========================
// Complete SMS functionality in one file

/**
 * Process message template with variables
 */
const processTemplateMessage = (messageTemplate, variables) => {
  if (!messageTemplate || !variables || !Array.isArray(variables)) {
    throw new Error('Message template and variables array are required');
  }
  
  let processedMessage = messageTemplate;
  
  variables.forEach((value) => {
    if (value === null || value === undefined) {
      throw new Error('Variable values cannot be null or undefined');
    }
    processedMessage = processedMessage.replace('{#var#}', String(value));
  });
  
  if (processedMessage.includes('{#var#}')) {
    throw new Error('Template has more placeholders than provided variables');
  }
  
  return processedMessage;
};

/**
 * Create SMS payload for the API
 */
const createSmsPayload = (templateId, message, phoneNumber) => {
  const numPayload = {
    "international": "NO",
    "countrycode": "91",
    "number": `91${phoneNumber}`,
    "message": message,
    "url": ""
  };
  
  return {
    "api": "d30caef1a8d9a782b1a19520b20f9db6",
    "senderid": "MBHIMA",
    "campaignid": "otpdemo",
    "channel": "otp",
    "templateid": templateId,
    "dcs": "0",
    "shorturl": "NO",
    "dlr": "NO",
    "data": [numPayload]
  };
};

/**
 * Send SMS to API
 */
const sendSmsToApi = async (payload) => {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/json");
  
  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: JSON.stringify(payload),
    redirect: "follow"
  };
  
  return await fetch("https://sms.versatilesmshub.com/api/smsservices.php", requestOptions)
    .then((response) => response.json())
    .then((result) => result)
    .catch((error) => error);
};

/**
 * Main SMS sending function
 */
export const sendSMS = async (req, res) => {
  try {
    const { name, number, otp, templateId } = req.body;

    // Validate required fields
    if (!name || !number || !templateId) {
      return res.status(400).json({
        error: "Missing required fields: name, number, templateId",
      });
    }

    // Validate phone number format
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(number)) {
      return res.status(400).json({
        error: "Invalid phone number format. Please provide a valid 10-digit Indian mobile number.",
      });
    }

    // Validate OTP format only for actual OTP template
    if (otp && templateId === "1707175594369642666") {
      const otpRegex = /^\d{4,6}$/;
      if (!otpRegex.test(otp)) {
        return res.status(400).json({
          error: "Invalid OTP format. OTP should be 4-6 digits.",
        });
      }
    }

    // Get template and variables based on templateId
    let messageTemplate;
    let variables;
    
    switch (templateId) {
      case "1707175594392963370":
        messageTemplate = "Hi {#var#}, welcome to Bhima E-Gold App! Your account has been successfully created with customer number {#var#}. Start exploring our amazing gold investment features and enjoy exclusive benefits.";
        variables = [name, otp];
        break;
      case "1707175594392963371":
        messageTemplate = "Great news! You've successfully joined \"{#var#}\" as \"{#var#}\". Your passbook number is {#var#}. Start your gold investment journey with us!";
        variables = [name, otp, "PB" + number.slice(-6)];
        break;
      case "1707175594392963372":
        messageTemplate = "Your installment payment of ₹{#var#} for {#var#} has been processed successfully. Thank you for keeping your gold investment on track!";
        variables = [otp, name + " Scheme"];
        break;
      case "1707175594392963369":
        messageTemplate = "Hi {#var#}, your scheme payment of ₹ {#var#} is due TODAY for {#var#}. Please make the payment immediately to keep your scheme active.";
        variables = [name, otp, name + " Gold Plan"];
        break;
      case "1707175594369642666":
      default:
        messageTemplate = "Dear {#var#} Your Login OTP for BHIMA e-Gold is {#var#}, Thank you for choosing BHIMA e-Gold.";
        variables = [name, otp];
        break;
    }

    // Process message template
    const processedMessage = processTemplateMessage(messageTemplate, variables);
    
    // Create and send SMS
    const payload = createSmsPayload(templateId, processedMessage, number);
    const smsResponse = await sendSmsToApi(payload);

    // Check if SMS was sent successfully
    if (smsResponse && (
        smsResponse.code === "200" || 
        smsResponse.code === "000" || 
        (smsResponse.response && smsResponse.response.code === "000")
    )) {
      return res.status(200).json({
        success: true,
        message: "SMS sent successfully",
        templateId: templateId,
        jobId: smsResponse.jobId || (smsResponse.response && smsResponse.response.jobId),
        response: smsResponse.response || smsResponse,
      });
    } else {
      return res.status(500).json({
        success: false,
        error: "Failed to send SMS",
        templateId: templateId,
        details: smsResponse?.message || (smsResponse?.response?.message) || "Unknown error occurred",
        response: smsResponse.response || smsResponse,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Internal server error while sending SMS",
      details: error.message,
    });
  }
};