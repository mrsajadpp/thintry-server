const mongoose = require('mongoose');
const { Schema } = mongoose;

const resetSchema = new Schema({
    user_id: {
        type: String,
        required: true,
    },
    token: {
        type: String,
        required: true,
    },
    reset_time: {
        type: Date,
        default: Date.now,
    },
});

const Code = mongoose.model('ResetLinkBin', resetSchema, 'resetlinksbin'); // specify the collection name

module.exports = Code;