const mongoose = require('mongoose');
const { Schema } = mongoose;

const reportSchema = new Schema({
    reporter_id: {
        type: String,
        required: true,
    },
    article_id: {
        type: String,
        required: true,
    },
    reason: {
        type: String,
        required: true,
    },
    reported_time: {
        type: Date,
        default: Date.now,
    },
});

const Code = mongoose.model('Report', reportSchema);

module.exports = Code;
