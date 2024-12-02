const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const geoip = require('geoip-lite');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer')
const upload = multer({ dest: 'uploads/' })

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
const ProfileImage = require("../model/user/profile");

// Default PFP
router.get('/pfp/default', async (req, res) => {
    try {
        const imagePath = path.join(__dirname, '..', "/public/image/pfp.jpg");

        const image = fs.readFileSync(imagePath);

        // Set the content type header to image/png
        res.setHeader('Content-Type', 'image/png');

        // Send the binary data as an image response
        res.send(image);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Fetch profile image
router.get('/pfp/:user_id', async (req, res) => {
    const { user_id } = req.params;

    // Validate the userId
    if (!user_id) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        userId = new mongoose.Types.ObjectId(user_id);
        const profile = await ProfileImage.findOne({ user_id: userId }).lean();

        if (!profile) {
            return res.status(404).json({ error: 'Profile picture not found' });
        }

        // Set the content type header to image/png
        res.setHeader('Content-Type', 'image/png');

        // Convert the Base64 string back to binary data
        const imageData = Buffer.from(profile.base64String, 'base64');

        // Send the binary data as an image response
        res.send(imageData);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Profile picture upload
router.post('/auth/pfp/upload', auth.verifyToken, upload.any(), async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user_id);

        if (!req.files || req.files.length === 0) {
            return res.status(400).send('No file uploaded.');
        }

        // Assuming the first file is the avatar
        const file = req.files[0];
        const imagePath = path.join(__dirname, '..', file.path);

        const imageData = fs.readFileSync(imagePath);
        const base64String = imageData.toString('base64');

        fs.unlinkSync(imagePath);

        let avatar = await ProfileImage.findOne({ user_id: userId }).lean();

        if (!avatar) {
            let pfp = new ProfileImage({ base64String, user_id: userId });
            await pfp.save();
            return res.status(200).json({ message: 'Avatar updated.' });
        }

        await ProfileImage.updateOne({ user_id: userId }, { base64String });
        return res.status(200).json({ message: 'Avatar updated.' });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});


module.exports = router;