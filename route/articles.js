const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const moment = require('moment');
var geoip = require('geoip-lite');
const cheerio = require('cheerio');

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
const Report = require("../model/report/model");
const ReportBin = require("../model/report/bin");
const CodeBin = require("../model/otp/bin");
const { default: mongoose } = require('mongoose');

const fetchImageFromPexels = async (query) => {
    const response = await fetch(`https://api.pexels.com/v1/search?query=${query}`, {
        method: 'GET',
        headers: {
            Authorization: process.env.PEXELS_API,
        },
    });
    const data = await response.json();

    return data.photos[0]?.src?.landscape; // returns the medium-sized image URL
};

// Request article for review
router.post('/request/review', auth.verifyToken, async (req, res) => {
    try {
        const {
            title,
            description,
            body
        } = req.body;

        const { user_id } = req;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }
        if (!body) {
            return res.status(400).json({ error: 'Article content is required' });
        }

        let user = await User.findOne({ _id: new mongoose.Types.ObjectId(user_id) }).lean();

        if (!user) {
            return res.status(400).json({ error: 'User is not exist' });
        }

        let articles = await Article.find().lean();

        // Load the HTML into Cheerio
        const $ = await cheerio.load(body);

        // Find the first image and get its 'src' attribute
        const firstImageSrc = await $('img').first().attr('src');

        const cover_image = await (firstImageSrc ? firstImageSrc : fetchImageFromPexels(title));


        // Image need to save to the server

        let keywords = await scrap.extractKeywordsUsingTFIDF(body, articles);

        let article = new ArticlePending({
            author_id: user._id,
            title: title,
            description: description,
            keywords,
            body: body,
            created_time: new Date(),
            slug: await format.generateSlug(title),
            updated_at: new Date(),
            cover_image
        });

        await article.save();

        return res.status(200).json({ message: 'Article succesfully submitted for review' });
    } catch (err) {
        console.error(err);

        return res.status(500).json({ error: 'Server error' });
    }
});

// Fetching article authenticated user
router.post('/auth/fetch', auth.verifyToken, async (req, res) => {
    try {
        const {
            slug
        } = req.body;

        if (!slug) {
            return res.status(400).json({ error: 'Slug is required' });
        }

        const token = req.header('Authorization');

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const { user_id } = await jwt.verify(token, process.env.SECRET_KEY);

        if (!user_id) {
            return res.status(400).json({ error: 'User id is required' });
        }

        let article = await Article.findOne({ slug: slug }).lean();

        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }

        let author = await User.findOne({ _id: new mongoose.Types.ObjectId(article.author_id) }).lean();

        article.date = new Date(article.updated_at).toLocaleDateString('en-US', {
            year: 'numeric',    // 4-digit year
            month: 'short',     // Abbreviated month (e.g., Jan, Feb)
            day: '2-digit'      // 2-digit day (e.g., 01, 02)
        });

        article.author_name = `${author.first_name} ${author.last_name}`;

        // Increment views and impressions
        await Article.updateOne({ _id: article._id }, { views: article.views += 1, impressions: article.impressions += 1 });

        interaction.updateUserInterests(user_id, article._id, 'click')
            .then(() => {
                return res.status(200).json({ article, message: 'User interests updated successfully' });
            })
            .catch(err => {
                return res.status(500).json({ error: 'Error updating user interests:' + err })
            });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Fetching article none authenticated user
router.post('/fetch', async (req, res) => {
    try {
        const {
            slug
        } = req.body;

        if (!slug) {
            return res.status(400).json({ error: 'Slug is required' });
        }

        let article = await Article.findOne({ slug: slug }).lean();


        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }

        let author = await User.findOne({ _id: new mongoose.Types.ObjectId(article.author_id) }).lean();

        article.date = new Date(article.updated_at).toLocaleDateString('en-US', {
            year: 'numeric',    // 4-digit year
            month: 'short',     // Abbreviated month (e.g., Jan, Feb)
            day: '2-digit'      // 2-digit day (e.g., 01, 02)
        });

        article.author_name = `${author.first_name} ${author.last_name}`;

        // Increment views and impressions
        await Article.updateOne({ _id: article._id }, { views: article.views += 1, impressions: article.impressions += 1 });

        return res.status(200).json({ article });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Fetching articles authenticated user
router.get('/auth/list/fetch/recomended', auth.verifyToken, async (req, res) => {
    try {
        const token = req.header('Authorization');

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const { user_id } = await jwt.verify(token, process.env.SECRET_KEY);

        if (!user_id) {
            return res.status(400).json({ error: 'User id is required' });
        }
        let recommendedArticles = await interaction.getRecommendedArticles(user_id);
        return res.status(200).json({ articles: recommendedArticles });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Fetching articles none authenticated user
router.get('/list/fetch', async (req, res) => {
    try {
        let articles = await Article.find().sort({ _id: -1 }).lean();
        return res.status(200).json({ articles });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Fetching articles based on a article
router.get('/list/fetch/related', async (req, res) => {
    try {
        let article_id = req.query.id;

        if (!article_id) {
            return res.status(400).json({ error: 'Article id is required' });
        }
        let article = await Article.findOne({ _id: new mongoose.Types.ObjectId(article_id) }).lean();
        if (!article) {
            return res.status(400).json({ error: 'Title is required' });
        }
        const articles = await Article.find({
            keywords: { $in: article.keywords },
            _id: { $ne: article._id }  // Exclude the current article by its id
        }).sort({ _id: -1 });

        return res.status(200).json({ articles });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Fetchign personal articles
router.get('/list/personal/fetch', auth.verifyToken, async (req, res) => {
    try {
        let user_id = req.query.user_id;
        if (!user_id) {
            return res.status(400).json({ error: 'User id is required' });
        }

        let articles = await Article.find({ author_id: new mongoose.Types.ObjectId(user_id) }).lean();
        return res.status(200).json({ articles });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Update published article
router.post('/update', auth.verifyToken, async (req, res) => {
    try {
        const {
            title,
            description,
            body,
            article_id
        } = req.body;

        const { user_id } = req;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }
        if (!body) {
            return res.status(400).json({ error: 'Article content is required' });
        }
        if (!article_id) {
            return res.status(400).json({ error: 'Article ID is required' });
        }

        let user = await User.findOne({ _id: new mongoose.Types.ObjectId(user_id) }).lean();

        if (!user) {
            return res.status(400).json({ error: 'User is not exist' });
        }

        let article = await Article.findOne({ _id: new mongoose.Types.ObjectId(article_id) }).lean();

        if (!article) {
            return res.status(400).json({ error: 'Article is not exist' });
        }

        let articles = await Article.find().lean();

        // Load the HTML into Cheerio
        const $ = await cheerio.load(body);

        // Find the first image and get its 'src' attribute
        const firstImageSrc = await $('img').first().attr('src');

        const cover_image = await (firstImageSrc ? firstImageSrc : (article.cover_image ? article.cover_image : fetchImageFromPexels(title)));

        // Image need to save to the server

        let keywords = await scrap.extractKeywordsUsingTFIDF(body, articles);

        await Article.updateOne({ _id: article._id }, { title, description, body, keywords, cover_image });

        return res.status(200).json({ message: 'Article succesfully updated' });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Update pending article 
router.post('/pending/update', auth.verifyToken, async (req, res) => {
    try {
        const {
            title,
            description,
            body,
            article_id
        } = req.body;

        const { user_id } = req;

        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }
        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }
        if (!body) {
            return res.status(400).json({ error: 'Article content is required' });
        }
        if (!article_id) {
            return res.status(400).json({ error: 'Article ID is required' });
        }

        let user = await User.findOne({ _id: new mongoose.Types.ObjectId(user_id) }).lean();

        if (!user) {
            return res.status(400).json({ error: 'User is not exist' });
        }

        let article = await ArticlePending.findOne({ _id: new mongoose.Types.ObjectId(article_id) }).lean();

        if (!article) {
            return res.status(400).json({ error: 'Article is not exist' });
        }

        let articles = await ArticlePending.find().lean();

        // Load the HTML into Cheerio
        const $ = await cheerio.load(body);

        // Find the first image and get its 'src' attribute
        const firstImageSrc = await $('img').first().attr('src');

        const cover_image = await (firstImageSrc ? firstImageSrc : (article.cover_image ? article.cover_image : fetchImageFromPexels(title)));

        // Image need to save to the server

        let keywords = await scrap.extractKeywordsUsingTFIDF(body, articles);

        await ArticlePending.updateOne({ _id: article._id }, { title, description, body, keywords, cover_image });

        return res.status(200).json({ message: 'Article succesfully updated' });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Liking article
router.post('/auth/like', auth.verifyToken, async (req, res) => {
    try {
        let { article_id } = req.body;
        if (!article_id) {
            return res.status(400).json({ error: "Article ID is required" });
        }
        let article = await Article.findOne({ _id: new mongoose.Types.ObjectId(article_id) }).lean();
        if (!article) {
            return res.status(400).json({ error: "Article not found" });
        }

        interaction.updateUserInterests(req.user_id, article._id, 'like')
            .then(() => {
                return res.status(200).json({ message: 'User interests updated successfully' });
            })
            .catch(err => {
                return res.status(500).json({ error: 'Error updating user interests:' + err })
            });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// Article deletion
router.post('/delete', auth.verifyToken, async (req, res) => {
    try {
        let { article_id } = req.body;
        if (!article_id) {
            return res.status(400).json({ error: "Article ID is required" });
        }
        let article = await Article.findOne({ _id: new mongoose.Types.ObjectId(article_id), author_id: new mongoose.Types.ObjectId(req.user_id) }).lean();

        if (!article) {
            return res.status(400).json({ error: "Article is not found or article id is wrong" });
        }

        article.reason = await "Deleted by author";
        article.deleted_by_author = await true;

        let articleBin = new ArticleBin(article);
        await articleBin.save();

        await Article.deleteOne({ _id: article._id });

        return res.status(200).json({ message: "Article has been deleted succesfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Report article
router.post('/report', auth.verifyToken, async (req, res) => {
    try {
        let { article_id, reason } = req.body;
        if (!article_id) {
            return res.status(400).json({ error: "Article ID is required" });
        }
        if (!reason) {
            return res.status(400).json({ error: "Reason is required" });
        }
        let article = await Article.findOne({ _id: new mongoose.Types.ObjectId(article_id) }).lean();

        if (!article) {
            return res.status(400).json({ error: "Article is not found or article id is wrong" });
        }

        let existReport = await Report.findOne({ reporter_id: new mongoose.Types.ObjectId(req.user_id), article_id: new mongoose.Types.ObjectId(article_id) }).lean();

        if (!existReport) {
            let report = new Report({ reporter_id: new mongoose.Types.ObjectId(req.user_id), reason, article_id: new mongoose.Types.ObjectId(article_id), reported_time: new Date() });
            await report.save();
        }

        return res.status(200).json({ message: "Article has been reported succesfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Fetch trending articles by interaction, views, and updated time
router.get('/list/fetch/trending', async (req, res) => {
    try {
        // Define the number of articles to return (can be passed as query param)
        const limit = parseInt(req.query.limit) || 10;

        // Fetch trending articles based on a combination of views, impressions, and updated_at
        const articles = await Article.find()
            .sort({
                views: -1,            // Sort by views in descending order
                impressions: -1,       // Then sort by impressions in descending order
                updated_at: -1         // Finally sort by the latest updated time
            })
            .limit(limit);            // Limit the number of articles returned

        return res.status(200).json({ articles });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});


module.exports = router; 