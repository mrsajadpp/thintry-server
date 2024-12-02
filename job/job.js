const schedule = require("node-schedule");
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

// */720 * * * * Job to check content violation
schedule.scheduleJob('*/720 * * * *', async () => {
  let articlesPending = await ArticlePending.find().lean();
  let articles = await Article.find().lean();
  articlesPending.forEach(async article => {
    let isValidTitle = await validator.containsBadWords(article.title);
    let isValidDescription = await validator.containsBadWords(article.description);
    let isValidContent = await validator.containsBadWords(article.body);
    if (isValidTitle) {
      mail(article);
      moveToBinPending(article);
    }
    if (isValidDescription) {
      mail(article);
      moveToBinPending(article);
    }
    if (isValidContent) {
      mail(article);
      moveToBinPending(article);
    }
  });
  articles.forEach(async article => {
    let isValidTitle = await validator.containsBadWords(article.title);
    let isValidDescription = await validator.containsBadWords(article.description);
    let isValidContent = await validator.containsBadWords(article.body);
    if (isValidTitle) {
      mail(article);
      moveToBin(article);
    }
    if (isValidDescription) {
      mail(article);
      moveToBin(article);
    }
    if (isValidContent) {
      mail(article);
      moveToBin(article);
    }
  });
});

async function moveToBinPending(article) {
  article.reason = await "Violating community guidelines";
  let bin = new ArticleBin(article);
  await bin.save();
  await ArticlePending.deleteOne({ _id: article._id });
}

async function moveToBin(article) {
  article.reason = await "Violating community guidelines";
  let bin = new ArticleBin(article);
  await bin.save();
  await Article.deleteOne({ _id: article._id });
}

async function mail(article) {
  let user = await User.findOne({ _id: article.author_id }).lean();
  sendMail({
    from: '"Grovix Lab" <noreply@grovixlab.com>',
    to: user.email,
    subject: "Your Article Has Been Removed",
    text: `We are pleased to inform you that your account registration with Grovix Lab has been successfully verified.`,
    html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Article Deletion Notification</title>
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
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">Dear ${user.first_name},</p>
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">We regret to inform you that your article titled "<strong>${article.title}</strong>" (Slug: ${article.slug}) has been deleted from our platform. This action was taken due to a violation of our community guidelines.</p>
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">Our guidelines are designed to ensure all content is respectful and suitable for our community. After a review, it was determined that the content of your article did not meet these standards.</p>
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">We encourage you to review our community guidelines to better understand our standards. You can access the guidelines <a href="https://www.grovixlab.com/community-guidelines">here</a>.</p>
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">If you have any questions or concerns, please contact us at <a href="mailto:support@grovixlab.com">support@grovixlab.com</a>.</p>
                                                          <p style="margin:10px 0 10px 0;color:#565a5c;font-size:18px">Thank you for your understanding and cooperation.</p>
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
}