const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
    },
    base64String: {
        type: String,
        required: true,
    },
});

const Image = mongoose.model('ProfileImage', imageSchema);

module.exports = Image;
