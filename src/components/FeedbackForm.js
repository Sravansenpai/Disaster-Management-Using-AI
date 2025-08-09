import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Form, Button, Alert, Row, Col, FloatingLabel } from 'react-bootstrap';
import { Star, StarFill } from 'react-bootstrap-icons';

const FeedbackForm = ({ aidId, aidType, volunteerId, onFeedbackSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState(null);

  // Common skill tags that users can select
  const availableTags = [
    'Communication', 
    'Timeliness', 
    'Helpfulness', 
    'Medical Knowledge', 
    'Technical Skills',
    'Driving',
    'Navigation',
    'Problem Solving',
    'Compassion'
  ];

  // Check if there's existing feedback for this volunteer/aid
  useEffect(() => {
    if (aidId && aidType && volunteerId) {
      const fetchExistingFeedback = async () => {
        try {
          const response = await axios.get(`/api/feedback/${aidType}/${aidId}`);
          const feedbacks = response.data;
          
          // Find feedback for this specific volunteer
          const volunteerFeedback = feedbacks.find(f => 
            f.volunteerId._id === volunteerId || f.volunteerId === volunteerId
          );
          
          if (volunteerFeedback) {
            setExistingFeedback(volunteerFeedback);
            setRating(volunteerFeedback.rating);
            setComment(volunteerFeedback.comment || '');
            setSelectedTags(volunteerFeedback.tags || []);
            setSuccess(true);
          }
        } catch (err) {
          console.log('No existing feedback found');
        }
      };
      
      fetchExistingFeedback();
    }
  }, [aidId, aidType, volunteerId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      // Validate input
      if (rating === 0) {
        setError('Please select a rating');
        setLoading(false);
        return;
      }
      
      const feedbackData = {
        aidId,
        aidType,
        volunteerId,
        rating,
        comment,
        tags: selectedTags
      };
      
      let response;
      
      if (existingFeedback) {
        // Update existing feedback
        response = await axios.put(`/api/feedback/${existingFeedback._id}`, feedbackData);
      } else {
        // Create new feedback
        response = await axios.post('/api/feedback', feedbackData);
      }
      
      setSuccess(true);
      setExistingFeedback(response.data);
      
      // Notify parent component
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(response.data);
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError(err.response?.data?.error || 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  const handleTagToggle = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  return (
    <Card className="mb-4 shadow-sm">
      <Card.Header as="h5" className="bg-primary text-white">
        {existingFeedback ? 'Update Your Feedback' : 'Rate Your Experience'}
      </Card.Header>
      <Card.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">
          {existingFeedback ? 'Your feedback has been updated!' : 'Thank you for your feedback!'}
        </Alert>}
        
        <Form onSubmit={handleSubmit}>
          {/* Star Rating */}
          <Form.Group className="mb-4 text-center">
            <Form.Label className="fw-bold">How would you rate the volunteer's service?</Form.Label>
            <div className="d-flex justify-content-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <div 
                  key={star} 
                  onClick={() => setRating(star)}
                  className="mx-1" 
                  style={{ cursor: 'pointer', fontSize: '2rem' }}
                >
                  {star <= rating ? <StarFill color="#FFD700" /> : <Star />}
                </div>
              ))}
            </div>
          </Form.Group>
          
          {/* Comment */}
          <Form.Group className="mb-4">
            <FloatingLabel controlId="commentInput" label="Additional comments (optional)">
              <Form.Control
                as="textarea"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Please share your experience..."
                style={{ height: '100px' }}
              />
            </FloatingLabel>
          </Form.Group>
          
          {/* Skill Tags */}
          <Form.Group className="mb-4">
            <Form.Label className="fw-bold">What skills did the volunteer demonstrate? (Select all that apply)</Form.Label>
            <Row>
              {availableTags.map((tag) => (
                <Col xs={6} md={4} key={tag}>
                  <Form.Check
                    type="checkbox"
                    id={`tag-${tag}`}
                    label={tag}
                    checked={selectedTags.includes(tag)}
                    onChange={() => handleTagToggle(tag)}
                    className="mb-2"
                  />
                </Col>
              ))}
            </Row>
          </Form.Group>
          
          <div className="d-grid">
            <Button
              variant="primary"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Submitting...' : (existingFeedback ? 'Update Feedback' : 'Submit Feedback')}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default FeedbackForm; 