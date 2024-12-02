const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const geoip = require('geoip-lite');
const mongoose = require('mongoose');

// Utils
const validator = require("../util/validate");
const unique = require("../util/unique");
const { sendMail } = require("../util/email");
const date = require("../util/date");
const format = require("../util/format");
const scrap = require("../util/scrap");

// Middleware
const auth = require("../middleware/auth");

// Database Models Importing
const Article = require("../model/article/model");
const ArticleBin = require("../model/article/bin");
const ArticlePending = require("../model/article/pending");
const User = require("../model/user/model");
const UserBin = require("../model/user/bin");
const UserPending = require("../model/user/pending");
const Code = require("../model/otp/model");
const CodeBin = require("../model/otp/bin");
const ProfileImage = require("../model/user/profile");
const ResetLink = require("../model/resetlink/model");
const ResetLinkBin = require("../model/resetlink/bin");

// Check if email exists
router.post('/check-email', async (req, res) => {
  const { email } = req.body;

  // Validate email
  if (!validator.validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // Check if the email exists in the User model
    const user = await User.findOne({ email });

    if (user) {
      return res.status(200).json({ exists: true, message: 'Email already exists' });
    }

    return res.status(200).json({ exists: false, message: 'Email is available' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Fetch user data (first_name, last_name, about) by user ID
router.get('/user-data', async (req, res) => {
  const { user_id } = req.body;

  // Validate the userId
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    userId = new mongoose.Types.ObjectId(user_id);
    // Find the user by ID and select only the required fields
    const user = await User.findById(userId).lean().select('first_name last_name about');
    const profile = await ProfileImage.findOne({ user_id: user._id }).lean();
    user.profile_url = await profile ? `/api/v1/img/pfp/${user._id}` : '/api/v1/img/pfp/default';

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Fetch user data by jwt
router.get('/own/user-data', auth.verifyToken, async (req, res) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  const { user_id } = await jwt.verify(token, process.env.SECRET_KEY);

  // Validate the userId
  if (!user_id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    userId = new mongoose.Types.ObjectId(user_id);
    // Find the user by ID and select only the required fields
    const user = await User.findById(userId).lean().select('first_name last_name about');
    const profile = await ProfileImage.findOne({ user_id: user._id }).lean();
    user.profile_url = await profile ? `http://192.168.1.60:3001/api/img/pfp/${user._id}` : 'http://192.168.1.60:3001/api/img/pfp/default';

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update user
router.post('/update', auth.verifyToken, async (req, res) => {
  const {
    first_name,
    last_name,
    country_code,
    contact_no,
    sex,
    about,
    address,
    date_of_birth
  } = req.body;

  try {
    let user = await User.findOne({ _id: req.user_id }).lean();
    await User.updateOne({ _id: new mongoose.Types.ObjectId(req.user_id) }, {
      first_name: first_name ? first_name : user.first_name,
      last_name: last_name ? last_name : user.last_name,
      country_code: country_code ? country_code : user.country_code,
      contact_no: contact_no ? contact_no : user.contact_no,
      sex: sex ? sex : user.sex,
      about: about ? about : user.about,
      address: address ? address : user.address,
      date_of_birth: date_of_birth ? date_of_birth : user.date_of_birth
    });
    res.status(200).json({ message: "User updation successfull" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Create password reset link
router.post('/reset-password', async (req, res) => {
  const { email } = req.body;

  // Validate email
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  if (!validator.validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // Check if the email exists in the User model
    const user = await User.findOne({ email }).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate a random token for password reset
    const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
      expiresIn: '1h'
    });

    // Create a password reset link
    const resetLink = `${process.env.BASE_URL}/reset-password/${token}`;

    // Save the reset link details to the ResetLink model
    const resetLinkDoc = new ResetLink({
      user_id: user._id,
      token,
      reset_time: new Date()
    });
    await resetLinkDoc.save();

    // Send the password reset link to the user's email
    await sendMail({
      from: '"Grovix Lab" <noreply@grovixlab.com>',
      to: email,
      subject: 'Password Reset Link',
      text: `Click on the following link to reset your password: ${resetLink}`,
      html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Request</title>
</head>
<body style="margin:0;padding:0" dir="ltr" bgcolor="#ffffff">
  <table border="0" cellspacing="0" cellpadding="0" align="center" id="email_table" style="border-collapse:collapse">
    <tbody>
      <tr>
        <td id="email_content" style="font-family:Helvetica Neue,Helvetica,Lucida Grande,tahoma,verdana,arial,sans-serif;background:#ffffff">
          <table border="0" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
            <tbody>
              <tr>
                <td height="20" style="line-height:20px"></td>
              </tr>
              <tr>
                <td>
                  <table border="0" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;text-align:center;width:100%">
                    <tbody>
                      <tr>
                        <td width="15px" style="width:15px"></td>
                        <td style="line-height:0px;max-width:600px;padding:0 0 15px 0">
                        </td>
                        <td width="15px" style="width:15px"></td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td>
                  <table border="0" width="430" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto">
                    <tbody>
                      <tr>
                        <td>
                          <table border="0" width="430px" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto;width:430px">
                            <tbody>
                              <tr>
                                <td width="15" style="display:block;width:15px"></td>
                              </tr>
                              <tr>
                                <td>
                                  <table border="0" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                                    <tbody>
                                      <tr>
                                        <td>
                                          <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                                            <tbody>
                                              <tr>
                                                <td width="20" style="display:block;width:20px"></td>
                                                <td>
                                                  <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                                                    <tbody>
                                                      <tr>
                                                        <td>
                                                          <p style="margin:10px 0;color:#565a5c;font-size:18px">Dear ${user.first_name},</p>
                                                          <p style="margin:10px 0;color:#565a5c;font-size:18px">You recently requested to reset your password for your account. Click on the button below to reset it.</p>
                                                          <p style="margin:10px 0;text-align:center;">
                                                              <a href="${resetLink}" style="display:inline-block;padding:10px 20px;color:#ffffff;background-color:#0078e8;border-radius:5px;text-decoration:none;">Reset Your Password</a>
                                                          </p>
                                                          <p style="margin:10px 0;color:#565a5c;font-size:18px">If the button above doesn't work, copy and paste the following link into your browser:</p>
                                                          <p style="word-break:break-all;color:#565a5c;font-size:18px;">
                                                              <a href="${resetLink}" style="color:#2b5a83;">${resetLink}</a>
                                                          </p>
                                                          <p style="margin:10px 0;color:#565a5c;font-size:18px">If you did not request a password reset, please ignore this email or contact our support if you have any questions.</p>
                                                          <p style="margin:10px 0;color:#565a5c;font-size:18px">Thank you,<br>The Grovix Lab Team</p>
                                                        </td>
                                                      </tr>
                                                      <tr>
                                                        <td height="20" style="line-height:20px"></td>
                                                      </tr>
                                                    </tbody>
                                                  </table>
                                                </td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                              <tr>
                                <td height="10" style="line-height:10px"></td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td>
                  <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto;width:100%;max-width:600px">
                    <tbody>
                      <tr>
                        <td height="4" style="line-height:4px"></td>
                      </tr>
                      <tr>
                        <td width="15px" style="width:15px"></td>
                        <td width="20" style="display:block;width:20px"></td>
                        <td style="text-align:center">
                          <div style="padding-top:10px;display:flex">
                            <div style="margin:auto"><img src="https://grovixlab.com/img/grovix-lab.png" height="20" alt=""></div><br>
                          </div>
                          <div style="height:10px"></div>
                          <div style="color:#abadae;font-size:11px;margin:0 auto 5px auto">© Grovix Lab. All rights reserved.<br></div>
                        </td>
                        <td width="20" style="display:block;width:20px"></td>
                        <td width="15px" style="width:15px"></td>
                      </tr>
                      <tr>
                        <td height="32" style="line-height:32px"></td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td height="20" style="line-height:20px"></td>
              </tr>
            </tbody>
          </table>
          <span><img src="https://grovixlab.com/img/grovix-lab.png" style="border:0;width:1px;height:1px"></span>
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>`
    });


    return res.status(200).json({ message: 'Password reset link sent to your email' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Reset user password
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  // Validate password and confirm password
  if (!password || !confirmPassword) {
    return res.status(400).json({ error: 'Password and confirm password are required' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Password and confirm password do not match' });
  }

  try {
    // Verify the password reset token
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    if (!jwt.decode) {
      return res.status(400).json({ error: 'Invalid Token' });
    }

    const userId = new mongoose.Types.ObjectId(decoded.userId);

    let resetlink = await ResetLink.findOne({ token: token }).lean();
    if (!resetlink) {
      return res.status(404).json({ error: 'Look like the link was expired' });
    }

    // Find the user by ID
    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update the user's password
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.updateOne({ _id: userId }, { password: hashedPassword });

    let resetLinkBin = new ResetLinkBin(resetlink);
    // Remove the password reset link
    await ResetLink.deleteOne({ user_id: userId });
    await resetLinkBin.save();

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Check if reset link URL exists
router.get('/check-reset-link/:token', async (req, res) => {
  const { token } = req.params;

  try {
    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const resetLink = await ResetLink.findOne({ token: token }).lean();

    if (!resetLink) {
      return res.status(404).json({ error: 'Reset link not found' });
    }

    return res.status(200).json({ exists: true, message: 'Reset link exists' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;