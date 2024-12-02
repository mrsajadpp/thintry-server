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
const interaction = require("../util/interaction");

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
const { default: mongoose } = require('mongoose');
const Report = require("../model/report/model");
const ReportBin = require("../model/report/bin");

// Approve article
router.post('/article/approve', auth.verifyAdmin, async (req, res) => {
  try {
    let { article_id } = req.body;
    if (!article_id) {
      return res.status(400).json({ message: "Article ID is required" });
    }
    let pendingArticle = await ArticlePending.findOne({ _id: new mongoose.Types.ObjectId(article_id) }).lean();

    if (!pendingArticle) {
      return res.status(400).json({ message: "Article is not found on pending list or article id is wrong" });
    }

    let article = new Article(pendingArticle);
    await article.save();

    await ArticlePending.deleteOne({ _id: pendingArticle._id });

    return res.status(200).json({ message: "Article has been approved succesfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Decline article
router.post('/article/decline', auth.verifyAdmin, async (req, res) => {
  try {
    let { article_id, reason } = req.body;
    if (!article_id) {
      return res.status(400).json({ message: "Article ID is required" });
    }
    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }
    let pendingArticle = await ArticlePending.findOne({ _id: new mongoose.Types.ObjectId(article_id) }).lean();

    if (!pendingArticle) {
      return res.status(400).json({ message: "Article is not found on pending list or article id is wrong" });
    }

    pendingArticle.reason = await reason;
    pendingArticle.status = await false;

    let article = new ArticleBin(pendingArticle);
    await article.save();

    await ArticlePending.deleteOne({ _id: pendingArticle._id });

    let user = await User.findOne({ _id: article.author_id }).lean();

    sendMail({
      from: '"Grovix Lab" <noreply@grovixlab.com>',
      to: user.email,
      subject: "Article Submission Update",
      text: `We regret to inform you that your article submission with the slug "${article.slug}" has been declined due to the following reason: ${reason}.`,
      html: `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Article Submission Update</title>
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
                                                                  <p style="margin:10px 0;color:#565a5c;font-size:18px">We regret to inform you that your article submission with the slug "<strong>${article.slug}</strong>" has been declined.</p>
                                                                  <p style="margin:10px 0;color:#565a5c;font-size:18px">The reason provided by our community guidelines team is: <strong>${reason}</strong>.</p>
                                                                  <p style="margin:10px 0;color:#565a5c;font-size:18px">If you have any concerns or need further clarification, please do not hesitate to reach out to us at <a href="mailto:support@grovixlab.com" style="color:#2b5a83">support@grovixlab.com</a>.</p>
                                                                  <p style="margin:10px 0;color:#565a5c;font-size:18px">Thank you for your understanding and continued engagement with Grovix Lab.</p>
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

    return res.status(200).json({ message: "Article has been declined succesfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Article deletion
router.post('/article/delete', auth.verifyAdmin, async (req, res) => {
  try {
    let { article_id, reason } = req.body;
    if (!article_id) {
      return res.status(400).json({ message: "Article ID is required" });
    }
    if (!reason) {
      return res.status(400).json({ message: "Reason is required" });
    }
    let article = await Article.findOne({ _id: new mongoose.Types.ObjectId(article_id) }).lean();

    if (!article) {
      return res.status(400).json({ message: "Article is not found or article id is wrong" });
    }

    article.reason = await reason;
    article.status = await true;

    let articleBin = new ArticleBin(article);
    await articleBin.save();

    await Article.deleteOne({ _id: article._id });

    let user = await User.findOne({ _id: article.author_id }).lean();

    sendMail({
      from: '"Grovix Lab" <noreply@grovixlab.com>',
      to: user.email,
      subject: "Article Deletion Notification",
      text: `Dear ${user.first_name}, 
        
        We regret to inform you that your article with the slug "${article.slug}" has been deleted due to the following reason: ${reason}. This action was taken by our Community Guidelines team to ensure the quality and safety of our platform.
        
        If you have any concerns or would like further clarification, please don't hesitate to contact us at support@grovixlab.com.
        
        Thank you for your understanding.
        
        Best regards,
        The Grovix Lab Team`,
      html: `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Grovix Lab Article Deletion Notification</title>
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
                                                                  <p style="margin:10px 0;color:#565a5c;font-size:18px">We regret to inform you that your article with the slug "${article.slug}" has been deleted due to the following reason: ${reason}. This action was taken by our Community Guidelines team to ensure the quality and safety of our platform.</p>
                                                                  <p style="margin:10px 0;color:#565a5c;font-size:18px">If you have any concerns or would like further clarification, please don't hesitate to contact us at <a href="mailto:support@grovixlab.com" style="color:#2b5a83">support@grovixlab.com</a>.</p>
                                                                  <p style="margin:10px 0;color:#565a5c;font-size:18px">Thank you for your understanding.</p>
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

    return res.status(200).json({ message: "Article has been deleted succesfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Article recover
router.post('/article/recover', auth.verifyAdmin, async (req, res) => {
  try {
    let { article_id } = req.body;
    if (!article_id) {
      return res.status(400).json({ message: "Article ID is required" });
    }
    let articleBin = await ArticleBin.findOne({ _id: new mongoose.Types.ObjectId(article_id) }).lean();

    if (!articleBin) {
      return res.status(400).json({ message: "Article is not found or article id is wrong" });
    }

    let article = new Article(articleBin);
    await article.save();

    await ArticleBin.deleteOne({ _id: articleBin._id });

    return res.status(200).json({ message: "Article has been recovered succesfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get Reports
router.get('/article/reports', auth.verifyAdmin, async (req, res) => {
  try {
    let reports = await Report.find().sort({ _id: -1 }).lean();
    return res.status(200).json({ reports });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Bin report
router.post('/article/report/bin', auth.verifyAdmin, async (req, res) => {
  try {
    let { report_id } = req.body;
    if (!report_id) {
      return res.status(400).json({ message: "Report ID is required" });
    }

    let report = await Report.findOne({ _id: new mongoose.Types.ObjectId(report_id) }).lean();

    if (!report) {
      return res.status(400).json({ message: "Report not found" });
    }

    let reportBin = new ReportBin(report);
    await reportBin.save();

    await Report.deleteOne({ _id: new mongoose.Types.ObjectId(report_id) });
    return res.status(200).json({ message: "Report moved to bin" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get all articles
router.get('/articles', auth.verifyAdmin, async (req, res) => {
  try {
    const articles = await Article.find().sort({ _id: -1 }).lean();
    return res.status(200).json({ articles });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get all users
router.get('/users', auth.verifyAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ _id: -1 }).lean();
    return res.status(200).json({ users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get user details
router.get('/user/:user_id', auth.verifyAdmin, async (req, res) => {
  try {
    const { user_id } = req.params;
    const user = await User.findOne({ _id: new mongoose.Types.ObjectId(user_id) }).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update user
router.patch('/user/:user_id', auth.verifyAdmin, async (req, res) => {
  try {
    const { user_id } = req.params;
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
    const user = await User.findOne({ _id: new mongoose.Types.ObjectId(user_id) });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    Object.assign(user, {
      first_name: first_name ? first_name : user.first_name,
      last_name: last_name ? last_name : user.last_name,
      country_code: country_code ? country_code : user.country_code,
      contact_no: contact_no ? contact_no : user.contact_no,
      sex: sex ? sex : user.sex,
      about: about ? about : user.about,
      address: address ? address : user.address,
      date_of_birth: date_of_birth ? date_of_birth : user.date_of_birth
    });
    await user.save();
    return res.status(200).json({ message: 'User updated successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get all pending articles
router.get('/articles/pending', auth.verifyAdmin, async (req, res) => {
  try {
    const pendingArticles = await ArticlePending.find().sort({ _id: -1 }).lean();
    return res.status(200).json({ pendingArticles });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get all declined articles
router.get('/articles/declined', auth.verifyAdmin, async (req, res) => {
  try {
    const declinedArticles = await ArticleBin.find({ deleted_by_author: false }).sort({ _id: -1 }).lean();
    return res.status(200).json({ declinedArticles });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;