const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^[a-zA-Z\s]{2,50}$/.test(v);
            },
            message: props => `${props.value} is not a valid name!`
        }
    },
    email: {
        type: String,
        sparse: true, // This allows multiple null values
        validate: {
            validator: function(v) {
                // Allow null or valid email
                return v === null || v === undefined || v === '' || 
                       /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    phone: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                // Allow international phone numbers
                return /^\+?[0-9\s-]{10,15}$/.test(v);
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    primaryLocation: String,
    additionalLocation: String,
    
    // Text-based location information (does not use GeoJSON)
    locationText: {
        name: String,     // Human-readable location name (city, area, etc.)
        address: String   // Full address 
    },
    
    // GeoJSON compatible location for MongoDB
    location: {
        // Only add coordinates if both lat and lng are provided
        type: { 
            type: String, 
            default: "Point" 
        },
        coordinates: [Number]  // Format: [longitude, latitude]
    },
    
    skillset: [String],
    availability: {
        type: Boolean,
        default: true
    },
    // Rating and feedback metrics
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    totalRatings: {
        type: Number,
        default: 0
    },
    // Skill-specific ratings
    skillRatings: {
        type: Map,
        of: Number,
        default: {}
    },
    // Performance metrics for volunteer ranking
    responseRate: {
        type: Number,
        default: 0
    },
    completedAids: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Before saving, make sure locationText.name is populated from primaryLocation if not set
volunteerSchema.pre('save', function(next) {
    // If locationText exists but name is not set, use primaryLocation
    if (!this.locationText) {
        this.locationText = {};
    }
    
    if (!this.locationText.name && this.primaryLocation) {
        this.locationText.name = this.primaryLocation;
    }
    
    if (!this.locationText.address && this.primaryLocation) {
        this.locationText.address = this.primaryLocation;
    }
    
    next();
});

// Only include the location field if coordinates are provided
volunteerSchema.pre('save', function(next) {
    // Clear any invalid location data
    if (!this.location || !this.location.coordinates || 
        !Array.isArray(this.location.coordinates) || 
        this.location.coordinates.length !== 2 ||
        typeof this.location.coordinates[0] !== 'number' ||
        typeof this.location.coordinates[1] !== 'number') {
        
        // Only set location.coordinates if we have valid lat/lng data
        if (this._tmpLat !== undefined && this._tmpLng !== undefined) {
            this.location = {
                type: "Point",
                coordinates: [this._tmpLng, this._tmpLat] // GeoJSON: [longitude, latitude]
            };
        } else {
            // Otherwise, unset the location field completely
            this.location = undefined;
        }
    }
    
    next();
});

// Add a 2dsphere index to the location field for geospatial queries
volunteerSchema.index({ location: "2dsphere" });

module.exports = mongoose.model('Volunteer', volunteerSchema); 