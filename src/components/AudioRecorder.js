import React, { useState, useRef } from 'react';
import axios from 'axios';
import './AudioRecorder.css';

const AudioRecorder = ({ onFormDataReady, type }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const mediaRecorderRef = useRef(null);

  const startRecording = () => {
    setIsRecording(true);
    setError('');
    setMessage('Recording... Speak clearly.');

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
      sampleRate: 16000
    } })
      .then(stream => {
        const audioContext = new AudioContext();
        const mediaStreamSource = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        mediaStreamSource.connect(analyser);
        
        // Determine MIME type
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
          console.log('Using MIME type:', mimeType);
        } else {
          console.log('opus not supported, using:', mimeType);
        }

        let mediaRecorder = new MediaRecorder(stream, {
          mimeType: mimeType,
          audioBitsPerSecond: 128000,
        });
        
        mediaRecorderRef.current = mediaRecorder;
        
        // Clear previous chunks
        const audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
            console.log('Received audio chunk:', event.data.size, 'bytes');
          }
        };

        mediaRecorder.onstop = () => {
          console.log('Recording stopped');
          stream.getTracks().forEach(track => track.stop());
          
          if (audioChunks.length === 0) {
            setError('No audio recorded. Please try again and speak louder.');
            setIsRecording(false);
            return;
          }
          
          const totalSize = audioChunks.reduce((size, chunk) => size + chunk.size, 0);
          if (totalSize < 1000) {
            setError('Audio recording too short or silent. Please try again and speak clearly.');
            setIsRecording(false);
            return;
          }
          
          const audioBlob = new Blob(audioChunks, { type: mimeType });
          console.log('Audio blob created:', audioBlob.size, 'bytes');
          
          processAudio(audioBlob);
        };

        mediaRecorder.start(250); // Collect data in 250ms chunks
        console.log('Recording started');
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
        setError('Could not access microphone: ' + error.message);
        setIsRecording(false);
      });
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('Recording stopped');
    }
  };

  const processAudio = async (audioBlob) => {
    try {
      setIsProcessing(true);
      setMessage('Processing audio... This may take a moment.');
      console.log('Sending audio to server...');
      console.log('Audio size:', audioBlob.size, 'bytes');

      // Create FormData
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('type', 'medical');

      // Send to backend for processing
      const response = await axios.post('http://localhost:5000/api/process-audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json'
        }
      });

      console.log('Server response:', response.data);

      if (response.data.success) {
        // Call the parent component with the form data
        onFormDataReady(response.data.form_data);
        setMessage('Audio processed successfully!');
        
        // Show transcription
        if (response.data.transcription) {
          console.log('Transcription:', response.data.transcription);
        }
      } else {
        setError('Failed to process audio: ' + response.data.message);
      }
    } catch (error) {
      console.error('Processing error:', error);
      let errorMessage = 'Error processing audio';
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage = error.response.data.message || errorMessage;
        console.error('Server error response:', error.response.data);
        console.error('Server status:', error.response.status);
        console.error('Server headers:', error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response from server. Please check if the Flask server is running on port 5000.';
        console.error('No response received:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage = error.message;
        console.error('Request setup error:', error);
      }
      
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
      setIsRecording(false);
    }
  };

  return (
    <div className="audio-recorder-container">
      <div className="button-container">
        {!isRecording ? (
          <button 
            onClick={startRecording} 
            disabled={isProcessing}
            className="record-button"
          >
            {isProcessing ? 'Processing...' : 'Start Recording'}
          </button>
        ) : (
          <button 
            onClick={stopRecording} 
            className="stop-button"
          >
            Stop Recording
          </button>
        )}
      </div>
      
      {message && <div className="message">{message}</div>}
      {error && <div className="error">{error}</div>}
      
      <div className="status-container">
        {isRecording && <div className="recording-indicator">Recording... Speak clearly into your microphone</div>}
        {isProcessing && <div className="processing-indicator">Processing audio...</div>}
      </div>
    </div>
  );
};

export default AudioRecorder; 