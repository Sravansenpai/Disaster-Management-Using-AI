const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    aidId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    aidType: {
        type: String,
        required: true,
        enum: ['medical', 'transport']
    },
    volunteerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Volunteer',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        maxlength: 500
    },
    tags: {
        type: [String],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create compound index to ensure a volunteer can only receive one feedback per aid request
feedbackSchema.index({ aidId: 1, aidType: 1, volunteerId: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', feedbackSchema); 