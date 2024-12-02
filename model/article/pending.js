const mongoose = require('mongoose');
const { Schema } = mongoose;

const articleSchema = new Schema({
    author_id: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    keywords: {
        type: [String],
        required: false,
    },
    body: {
        type: String,
        required: true,
    },
    created_time: {
        type: String,
        default: Date.now,
    },
    views: {
        type: Number,
        required: false,
        default: 0
    },
    impressions: {
        type: Number,
        default: 0,
    },
    country_views: {
        type: Map,
        of: Number,
        default: {},
    },
    slug: {
        type: String,
        required: true,
    },
    cover_image: {
        type: String,
        required: true,
    },
    updated_at: {
        type: String,
        default: Date.now,
    }
});

const Article = mongoose.model('ArticlePending', articleSchema);

module.exports = Article;
