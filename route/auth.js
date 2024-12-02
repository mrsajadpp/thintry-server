const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const moment = require('moment');
var geoip = require('geoip-lite');

// Utils
const validator = require("../util/validate");
const unique = require("../util/unique");
const { sendMail } = require("../util/email");
const date = require("../util/date");
const format = require("../util/format");
const scrap = require("../util/scrap");

// Database Models Importing
const Article = require("../model/article/model");
const ArticleBin = require("../model/article/bin");
const ArticlePending = require("../model/article/pending");
const User = require("../model/user/model");
const UserBin = require("../model/user/bin");
const UserPending = require("../model/user/pending");
const Code = require("../model/otp/model");
const CodeBin = require("../model/otp/bin");
const { default: mongoose } = require('mongoose');


// User registration
router.post('/register', async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      country_code,
      contact_no,
      password
    } = req.body;

    if (!first_name) {
      return res.status(400).json({ error: 'First name is required' });
    }
    if (!last_name) {
      return res.status(400).json({ error: 'Last name is required' });
    }
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    if (!country_code) {
      return res.status(400).json({ error: 'Country code is required' });
    }
    if (!contact_no) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
    if (!validator.validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    let existUser = await User.findOne({ email: email }).lean();
    let existPendingUser = await UserPending.findOne({ email: email }).lean();
    let existBinUser = await UserBin.findOne({ email: email }).lean();
    if (existUser || existBinUser) {
      return res.status(400).json({ error: 'User with this email exist' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let user = null;
    let otp = null;

    if (existPendingUser) {
      const userData = {
        first_name,
        last_name,
        email,
        country_code,
        contact_no,
        password: hashedPassword,
        status: false,
        admin: false,
        verified: false,
      };


      await UserPending.updateOne({ email: email }, userData);
      user = await UserPending.findOne({ email: email }).lean();
      otp = {
        user_id: user._id,
        email: user.email,
        verification_code: await unique.generateOTP(),
        created_time: new Date()
      }
      await Code.updateOne({ user_id: user._id }, otp);
    } else {
      user = new UserPending({
        first_name,
        last_name,
        email,
        country_code,
        contact_no,
        password: hashedPassword,
        status: false,
        admin: false,
        verified: false,
      });

      await user.save();

      otp = new Code({
        user_id: user._id,
        email: user.email,
        verification_code: await unique.generateOTP(),
        created_time: new Date()
      });

      await otp.save();
    }

    sendMail({
      from: '"Grovix Lab" <noreply@grovixlab.com>',
      to: email,
      subject: "OTP Verification for Your Grovix Lab Account",
      text: `Hello,
        
        We received a request to verify your email address. Please use the following OTP to complete the verification process:
        
        OTP: ${otp.verification_code}
        
        This OTP is valid for 5 minutes. If you did not request this, please ignore this email.
        
        Thank you for using our services.`,
      html: `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Grovix OTP Verification</title>
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
                          <table border="0" width="430" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto 0 auto">
                            <tbody>
                              <tr>
                                <td>
                                  <table border="0" width="430px" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto 0 auto;width:430px">
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
                                                                  <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">Dear User,</p>
                                                                  <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">We received a request to verify your email address. Please use the OTP below to complete the verification process:</p>
                                                                  <p style="margin:10px 0 10px 0;color:#565a5c;font-size:24px;font-weight:bold;text-align:center">${otp.verification_code}</p>
                                                                  <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">This OTP is valid for 5 minutes. If you did not request this, please ignore this email.</p>
                                                                  <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">Thank you for using our services.</p>
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
                          <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto 0 auto;width:100%;max-width:600px">
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
                                  <div style="color:#abadae;font-size:11px;margin:0 auto 5px auto">© Grovix. All rights reserved.<br></div>
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


    res.status(201).json({ message: 'User registered successfully', user: { first_name, last_name, email, user_id: user._id } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// OTP verification
router.post('/verify-otp', async (req, res) => {
  try {
    const {
      user_id,
      otp
    } = req.body;


    if (!user_id) {
      return res.status(400).json({ error: 'User id required' });
    }
    if (!otp) {
      return res.status(400).json({ error: 'OTP id required' });
    }

    const otpRecord = await Code.findOne({ user_id: new mongoose.Types.ObjectId(user_id), verification_code: otp }).lean();

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid OTP or User not registered' });
    }

    const isExpired = moment().diff(moment(otpRecord.created_time), 'minutes') > 5;
    if (isExpired) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    if (otpRecord.verification_code === parseInt(otp)) {
      const pendingUser = await UserPending.findOne({ _id: new mongoose.Types.ObjectId(user_id) }).lean();

      pendingUser.status = true;
      pendingUser.admin = false;

      const user = new User(pendingUser);

      await user.save();

      await Code.deleteOne({ user_id: new mongoose.Types.ObjectId(user_id) });
      await UserPending.deleteOne({ _id: new mongoose.Types.ObjectId(user_id) });



      const token = await jwt.sign({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        country_code: user.country_code,
        contact_no: user.contact_no,
        date_of_birth: user.date_of_birth,
        status: user.status,
        admin: user.admin,
        verified: user.verified,
        address: user.address,
        user_id: user._id
      }, process.env.SECRET_KEY);

      sendMail({
        from: '"Grovix Lab" <noreply@grovixlab.com>',
        to: user.email,
        subject: "Account Registration Successfully Verified",
        text: `We are pleased to inform you that your account registration with Grovix Lab has been successfully verified.`,
        html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grovix Lab Account Verification</title>
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
                                                          <p style="margin:10px 0;color:#565a5c;font-size:18px">We are pleased to inform you that your account registration with Grovix Lab has been successfully verified.</p>
                                                          <p style="margin:10px 0;color:#565a5c;font-size:18px">You can now access all the features and services available through your account. If you have any questions or need further assistance, please contact us at <a href="mailto:support@grovixlab.com" style="color:#2b5a83">support@grovixlab.com</a>.</p>
                                                          <p style="margin:10px 0;color:#565a5c;font-size:18px">Thank you for joining Grovix Lab. We look forward to your continued engagement with us.</p>
                                                          <p style="margin:10px 0;color:#565a5c;font-size:18px">Best regards,</p>
                                                          <p style="margin:10px 0;color:#565a5c;font-size:18px">The Grovix Lab Team</p>
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

      return res.status(200).json({ message: 'Email verified successfully', jwt_token: token });
    } else {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const deviceInfo = req.device;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    var geo = await geoip.lookup(clientIp);

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    if (!validator.validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    let existUser = await User.findOne({ email: email }).lean();
    if (!existUser) {
      return res.status(400).json({ error: 'User not exist' });
    }
    const isCorrectPassword = await bcrypt.compare(password, existUser.password);
    if (isCorrectPassword) {
      const token = await jwt.sign({
        first_name: existUser.first_name,
        last_name: existUser.last_name,
        email: existUser.email,
        country_code: existUser.country_code,
        contact_no: existUser.contact_no,
        date_of_birth: existUser.date_of_birth,
        status: existUser.status,
        admin: existUser.admin,
        verified: existUser.verified,
        address: existUser.address,
        user_id: existUser._id
      }, process.env.SECRET_KEY);

      let device = `${deviceInfo.model}, ${deviceInfo.type}`;
      let location = `${geo && geo.country ? geo.country : 'unknown'}, ${geo && geo.city ? geo.city : 'unknown'}, ${geo && geo.timezone ? geo.timezone : 'unknown'}`;

      sendMail({
        from: '"Grovix Lab" <noreply@grovixlab.com>',
        to: existUser.email,
        subject: "New Login Alert for Your Grovix Lab Account",
        text: `We wanted to let you know that your Grovix Lab account was recently accessed from a new device or location.`,
        html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grovix Login Alert</title>
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
                  <table border="0" width="430" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto 0 auto">
                    <tbody>
                      <tr>
                        <td>
                          <table border="0" width="430px" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto 0 auto;width:430px">
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
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">Dear ${existUser.first_name},</p>
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">We wanted to let you know that your Grovix Lab account was recently accessed from a new device or location. Here are the details of the login:</p>
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">Date and Time: ${date.formatDate(new Date())}</p>
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">Location: ${location}</p>
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">Device: ${device}</p>
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">If this was you, there is no need for further action. However, if you do not recognize this login attempt, please take the following steps to secure your account:</p>
                                                          <ul style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">
                                                            <li>Change Your Password: Immediately update your password by visiting your account settings.</li>
                                                            <li>Review Recent Activity: Check your account activity for any unauthorized actions.</li>
                                                            <li>Contact Support: If you have any concerns, please reach out to our support team at <a href="mailto:support@grovixlab.com" style="color:#0078e8;text-decoration:none">support@grovixlab.com</a>.</li>
                                                          </ul>
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">Your security is important to us. If you need any assistance or have any questions, feel free to contact us at <a href="mailto:support@grovixlab.com" style="color:#0078e8;text-decoration:none">support@grovixlab.com</a>.</p>
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">Thank you for being a valued member of Grovix Lab.</p>
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
                          <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 auto 0 auto;width:100%;max-width:600px">
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
                                  <div style="color:#abadae;font-size:11px;margin:0 auto 5px auto">© Grovix. All rights reserved.<br></div>
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

      return res.status(200).json({ message: 'Login successfully', jwt_token: token });
    } else {
      return res.status(400).json({ error: 'Invalid password' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;