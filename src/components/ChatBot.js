import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';

import './ChatBot.css';
// Change this line
import chopperImage from '../assets/images/chopper.png';


import { getFirstAidAdvice } from '../utils/firstAidAdvice';
// Remove OpenAI import
// import OpenAI from 'openai';

// Add these helper functions before the ChatBot component
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create Hugging Face API configuration
const getHuggingFaceConfig = () => {
  // Check all possible environment variable names where the API key might be stored
  const apiKey = process.env.REACT_APP_HUGGINGFACE_API_KEY || 
                process.env.HUGGING_FACE_API_KEY || 
                "hf_ElgR4vCaPIJfweGIDBqxILBs9DCb0Ejq"; // Use the key from .env file as fallback
  
  console.log('API Key check:', 
    process.env.REACT_APP_HUGGINGFACE_API_KEY ? 'REACT_APP_HUGGINGFACE_API_KEY found' : 'REACT_APP_HUGGINGFACE_API_KEY missing',
    process.env.HUGGING_FACE_API_KEY ? 'HUGGING_FACE_API_KEY found' : 'HUGGING_FACE_API_KEY missing'
  );
  
  if (!apiKey) {
    console.error('Hugging Face API key is missing in environment variables');
    return null;
  }
  
  console.log('Using Hugging Face API key:', apiKey.substring(0, 5) + '...');
  
  return {
    apiKey,
    apiUrl: 'https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta'
  };
};

const callOpenAIWithRetry = async (messages, maxRetries = 3, initialDelay = 1000) => {
  let lastError;
  let retryDelay = initialDelay;

  // Get Hugging Face configuration
  let hfConfig = getHuggingFaceConfig();
  
  if (!hfConfig || !hfConfig.apiKey) {
    console.error('API configuration error:', {
      config: hfConfig ? 'Config exists but may be missing apiKey' : 'No config returned',
      envVars: {
        REACT_APP_HUGGINGFACE_API_KEY: process.env.REACT_APP_HUGGINGFACE_API_KEY ? 'exists' : 'missing',
        HUGGING_FACE_API_KEY: process.env.HUGGING_FACE_API_KEY ? 'exists' : 'missing',
        NODE_ENV: process.env.NODE_ENV
      }
    });
    
    // Try with hardcoded key if config is missing
    if (!hfConfig) {
      console.log('Trying with hardcoded API key as fallback');
      const fallbackKey = "hf_ElgR4vCaPIJfweGIDBqxILBs9DCb0Ejq";
      hfConfig = {
        apiKey: fallbackKey,
        apiUrl: 'https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta'
      };
    }
    
    // If still no valid config, throw error
    if (!hfConfig || !hfConfig.apiKey) {
      throw new Error('API key is missing. Please check your environment configuration.');
    }
  }

  // Format messages for Hugging Face format
  const formattedPrompt = formatMessagesForHuggingFace(messages);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`API attempt ${attempt + 1}/${maxRetries}`);
      
      const response = await axios.post(
        hfConfig.apiUrl,
        { 
          inputs: formattedPrompt,
          parameters: {
            max_new_tokens: 1000,
            temperature: 0.7,
            top_p: 0.95,
            do_sample: true,
            return_full_text: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${hfConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Hugging Face API response received:', {
        status: response.status,
        hasData: !!response.data,
        dataLength: response.data ? response.data.length : 0
      });
      
      if (response.data && response.data[0] && response.data[0].generated_text) {
        // Extract the generated text from response
        const result = response.data[0].generated_text.replace(formattedPrompt, '').trim();
        console.log('Generated response (first 100 chars):', result.substring(0, 100) + '...');
        return result;
      } else {
        throw new Error('Invalid response format from Hugging Face API');
      }
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt + 1} failed:`, error.message);
      
      // Log detailed error information
      if (error.response) {
        console.error('API error details:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      }
      
      // Check for rate limit errors or model loading
      if (error.response && (
          error.response.status === 429 || // Rate limit
          error.response.status === 503 || // Service unavailable
          (error.response.data && error.response.data.error && 
           error.response.data.error.includes('Model is currently loading'))
      )) {
        console.log(`Rate limited or model loading. Retrying in ${retryDelay}ms...`);
        await delay(retryDelay);
        // Exponential backoff
        retryDelay *= 2;
        continue;
      }
      
      // For other errors, don't retry
      break;
    }
  }
  
  // If we get here, all retries failed
  throw lastError;
};

// Helper function to format messages for Hugging Face
const formatMessagesForHuggingFace = (messages) => {
  console.log('Formatting messages for Hugging Face:', JSON.stringify(messages).substring(0, 200) + '...');
  
  // For Mistral model, format messages in a specific way
  let formattedPrompt = '';
  
  // Extract system message for context
  const systemMessage = messages.find(msg => msg.role === 'system');
  if (systemMessage) {
    formattedPrompt += `<s>System: ${systemMessage.content}</s>\n\n`;
  } else {
    // Add default system message if none provided
    formattedPrompt += `<s>System: You are Dr. Chopper, a helpful medical assistant providing advice on medical conditions.</s>\n\n`;
  }
  
  // Add conversation messages
  for (const msg of messages.filter(m => m.role !== 'system')) {
    if (msg.role === 'user') {
      formattedPrompt += `<s>User: ${msg.content}</s>\n\n`;
    } else if (msg.role === 'assistant') {
      formattedPrompt += `<s>Assistant: ${msg.content}</s>\n\n`;
    }
  }
  
  // Add final prompt for the assistant to respond
  formattedPrompt += `<s>Assistant:`;
  
  console.log('Formatted prompt (first 100 chars):', formattedPrompt.substring(0, 100) + '...');
  return formattedPrompt;
};

// Add a local LLM function that does basic medical advice
const generateLocalMedicalAdvice = (data) => {
  // Extract the most important information
  const patientName = data.patientName || '';
  const condition = data.condition || '';
  const additionalInfo = data.additionalInfo || '';
  const urgency = data.urgency || 'medium';
  const location = data.location || '';
  
  // Get first aid advice based on condition
  const basicAdvice = getFirstAidAdvice(condition || additionalInfo);
  
  // Add urgency-based recommendations
  let emergencyCare = '';
  if (urgency === 'critical' || urgency === 'high') {
    emergencyCare = `
    EMERGENCY CARE:
    • This appears to be a HIGH URGENCY situation
    • Seek immediate medical attention at your nearest emergency room${location ? ` in ${location}` : ''}
    • Call emergency services (911/102/108) if the condition is deteriorating
    `;
  } else if (urgency === 'medium') {
    emergencyCare = `
    MEDICAL CARE:
    • This appears to be a MEDIUM URGENCY situation
    • Visit an urgent care center or your primary physician within 24 hours${location ? ` in ${location}` : ''}
    • Monitor the condition closely for any changes
    `;
  } else {
    emergencyCare = `
    MEDICAL CARE:
    • This appears to be a LOW URGENCY situation
    • Schedule an appointment with your primary physician${location ? ` in ${location}` : ''}
    • Keep monitoring the condition for any changes
    `;
  }
  
  // Add personal greeting if name is available
  const greeting = patientName ? 
    `Hello ${patientName}, I'm Dr. Chopper. I've analyzed your condition${condition ? ` (${condition})` : ''} and have the following recommendations for you.\n\n` :
    '';
  
  // Combine everything
  return `
  ${greeting}# Medical Advice${condition ? ` for: ${condition}` : ''}
  
  ## First Aid Recommendations
  ${basicAdvice}
  
  ## Medical Care Recommendations
  ${emergencyCare}
  
  ## Important Warning Signs${patientName ? ` to watch for, ${patientName}` : ''}
  • Difficulty breathing or shortness of breath
  • Severe pain or pressure in the chest
  • Confusion or altered mental state
  • Severe headache, especially if sudden onset
  • Persistent vomiting or inability to keep fluids down
  • High fever not responding to medication
  
  ## Follow-up Care
  • Document your symptoms and their progression
  • Prepare a list of questions for your healthcare provider
  • Bring a list of current medications to your appointment
  ${location ? `• Consider contacting healthcare facilities in ${location} for availability` : ''}
  
  IMPORTANT: This is generated advice only. Always seek professional medical help for proper diagnosis and treatment.
  `.trim();
};

// Add this function to fetch medical aid requests by patient name
const fetchMedicalAidByName = async (name) => {
  try {
    const response = await axios.get(`/api/medical-aid/search/name/${encodeURIComponent(name)}`);
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return { success: false, message: 'No medical aid requests found for this name' };
    }
    console.error('Error fetching medical aid by name:', error);
    return { success: false, message: 'Error fetching medical aid information' };
  }
};

// Format the medical aid request into a readable message
const formatMedicalAidInfo = (request) => {
  if (!request) return '';
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const statusEmoji = {
    'pending': '⏳',
    'assigned': '📋',
    'in-progress': '🏃‍♂️',
    'completed': '✅',
    'cancelled': '❌'
  };

  const urgencyEmoji = {
    'low': '🟢',
    'medium': '🟡',
    'high': '🔴'
  };

  return `
### Medical Aid Request Details ${statusEmoji[request.status] || ''}

**Patient**: ${request.patientName}
**Condition**: ${request.condition}
**Location**: ${request.location}
**Urgency**: ${urgencyEmoji[request.urgency] || ''} ${request.urgency}
**Status**: ${statusEmoji[request.status] || ''} ${request.status}
**Submitted**: ${formatDate(request.createdAt)}

${request.additionalInfo ? `**Additional Information**: ${request.additionalInfo}` : ''}

${request.status === 'assigned' || request.status === 'in-progress' 
  ? '**Help is on the way!** A volunteer has been assigned to your request.' 
  : request.status === 'completed' 
  ? '**Request completed.** This medical aid request has been marked as completed.' 
  : request.status === 'pending' 
  ? '**Request pending.** We are currently looking for volunteers to assist you.' 
  : ''}
`.trim();
};

const ChatBot = forwardRef(({ formData }, ref) => {
  // Check if this is a new browser session
  const isNewSession = useRef(sessionStorage.getItem('chatbot_initialized') !== 'true');
  
  // Generate a unique ID for this chat session
  const chatSessionId = useRef((() => {
    // If this is a new browser session, generate a new session ID
    if (isNewSession.current) {
      const newSessionId = `session_${Date.now()}`;
      localStorage.setItem('chatbot_session_id', newSessionId);
      return newSessionId;
    }
    // Otherwise, use the existing session ID or create a new one
    return localStorage.getItem('chatbot_session_id') || `session_${Date.now()}`;
  })());

  // Mark that we've initialized the chatbot in this session
  useEffect(() => {
    if (isNewSession.current) {
      // Reset the chat for new browser sessions
      const initialMessage = { 
        type: 'bot', 
        content: 'Hello! I\'m Dr. Chopper. I can analyze your medical condition and provide specific advice about medicines, first aid, and hospital recommendations. How can I help you today?' 
      };
      setMessages([initialMessage]);
      localStorage.setItem(`chatbot_messages_${chatSessionId.current}`, JSON.stringify([initialMessage]));
      
      // Mark that we've initialized the chat in this session
      sessionStorage.setItem('chatbot_initialized', 'true');
      isNewSession.current = false;
    }
  }, []);

  // Initialize states with values from localStorage
  const [isOpen, setIsOpen] = useState(() => {
    // For new sessions, always start closed
    if (isNewSession.current) {
      return false;
    }
    // Try to restore the open state from localStorage
    const savedState = localStorage.getItem('chatbot_isOpen');
    return savedState === 'true';
  });
  
  const [messages, setMessages] = useState(() => {
    // For new sessions, start with the initial message
    if (isNewSession.current) {
      return [{ 
        type: 'bot', 
        content: 'Hello! I\'m Dr. Chopper. I can analyze your medical condition and provide specific advice about medicines, first aid, and hospital recommendations. How can I help you today?' 
      }];
    }
    // Load messages from localStorage if available for this session
    const savedMessages = localStorage.getItem(`chatbot_messages_${chatSessionId.current}`);
    return savedMessages ? JSON.parse(savedMessages) : [
    { 
      type: 'bot', 
      content: 'Hello! I\'m Dr. Chopper. I can analyze your medical condition and provide specific advice about medicines, first aid, and hospital recommendations. How can I help you today?' 
    }
    ];
  });
  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
  // Save session ID to localStorage on component mount
  useEffect(() => {
    localStorage.setItem('chatbot_session_id', chatSessionId.current);
    
    // This function handles page unloads (including navigation)
    const handleBeforeUnload = () => {
      // Force save the current messages state to localStorage before page unloads
      localStorage.setItem(`chatbot_messages_${chatSessionId.current}`, JSON.stringify(messages));
      localStorage.setItem('chatbot_isOpen', isOpen.toString());
    };
    
    // This function runs when the page is about to be hidden (like tab switching or navigating away)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBeforeUnload();
      }
    };
    
    // Add event listeners for page unload and visibility change
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also attach to the history navigation events
    window.addEventListener('popstate', handleBeforeUnload);
    
    return () => {
      // Clean up event listeners
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('popstate', handleBeforeUnload);
    };
  }, [messages, isOpen]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`chatbot_messages_${chatSessionId.current}`, JSON.stringify(messages));
  }, [messages]);
  
  // Save open state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('chatbot_isOpen', isOpen.toString());
  }, [isOpen]);

  const toggleChat = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    // Save the open state in localStorage
    localStorage.setItem('chatbot_isOpen', newState.toString());
    
    // If opening the chat and we have form data, generate advice
    if (newState && formData && (formData.condition || formData.additionalInfo)) {
      generateAdvice(formData);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Generate advice when form data changes
  useEffect(() => {
    console.log('ChatBot received formData update:', formData);
    
    if (formData && (formData.condition || formData.additionalInfo)) {
      // Check if we have meaningful content to analyze
      const hasContent = 
        (formData.condition && formData.condition.length > 0 && formData.condition !== 'Select Condition Type') ||
        (formData.additionalInfo && formData.additionalInfo.length > 10);
        
      if (hasContent) {
        console.log('ChatBot has form data available for advice, but will wait until manually triggered');
        // We no longer automatically generate advice or open the ChatBot here
        // The parent component will handle opening and triggering advice generation
      } else {
        console.log('Not enough meaningful content to generate advice yet');
      }
    }
  }, [formData]);

  const generateAdvice = async (data) => {
    // Don't generate if missing important information
    if (!data || (!data.condition && !data.additionalInfo)) return;

    setIsLoading(true);

    try {
      // Check if we have a patient name to look up
      let medicalAidInfo = null;
      if (data.patientName) {
        try {
          const medicalAidResponse = await fetchMedicalAidByName(data.patientName);
          if (medicalAidResponse.success && medicalAidResponse.data && medicalAidResponse.data.length > 0) {
            medicalAidInfo = medicalAidResponse.data[0]; // Get the most recent request
            console.log('Found medical aid request for form submission:', medicalAidInfo);
          }
        } catch (error) {
          console.error('Error fetching medical aid info:', error);
        }
      }

      // Don't add a system message, just log the condition we're analyzing
      const patientName = data.patientName || 'the patient';
      const conditionText = data.condition ? data.condition : 
                           (data.additionalInfo ? data.additionalInfo : 'medical condition');
      
      console.log(`Analyzing ${patientName}'s condition: ${conditionText}`);

      // Create a comprehensive prompt combining all form data with personalization
      let prompt = `As Dr. Chopper, provide personalized medical advice for a patient with the following information:\n\n`;
      
      // Add all available form fields to the prompt with emphasis on personalization
      if (data.patientName) prompt += `Patient Name: ${data.patientName}\n`;
      if (data.condition) prompt += `Medical Condition: ${data.condition}\n`;
      if (data.symptoms) prompt += `Symptoms: ${data.symptoms}\n`;
      if (data.duration) prompt += `Duration: ${data.duration}\n`;
      if (data.age) prompt += `Patient Age: ${data.age}\n`;
      if (data.gender) prompt += `Patient Gender: ${data.gender}\n`;
      if (data.medicalHistory) prompt += `Medical History: ${data.medicalHistory}\n`;
      if (data.currentMedications) prompt += `Current Medications: ${data.currentMedications}\n`;
      if (data.allergies) prompt += `Allergies: ${data.allergies}\n`;
      if (data.location) prompt += `Patient Location: ${data.location}\n`;
      if (data.contactNumber) prompt += `Contact Number: ${data.contactNumber}\n`;
      if (data.additionalInfo) prompt += `Additional Information: ${data.additionalInfo}\n`;
      
      // Add urgency level if available
      if (data.urgency) {
        prompt += `Urgency Level: ${data.urgency}\n`;
      }

      // Add information about existing medical aid request if found
      if (medicalAidInfo) {
        const medicalAidInfoText = formatMedicalAidInfo(medicalAidInfo);
        prompt += `\nExisting Medical Aid Request Information:\n${medicalAidInfoText}\n\n`;
      }

      prompt += `\nPlease provide the following information in a clear, structured format, addressing ${data.patientName || 'the patient'} by name:

1. Personal Greeting: Address ${data.patientName || 'the patient'} directly with a brief, empathetic response about their condition.

2. Immediate First Aid Steps: Provide specific first aid advice tailored to ${data.patientName || 'the patient'}'s condition. Be detailed and practical.

3. Medication Recommendations: Suggest appropriate over-the-counter medications, including specific names, dosages, and usage guidelines relevant to the condition.

4. Emergency Care Indicators: Clearly indicate when ${data.patientName || 'the patient'} should seek immediate emergency care based on their specific symptoms and condition.

5. Hospital Recommendations: If the condition is critical, recommend specific types of medical facilities. If a location is provided (${data.location || 'unknown'}), mention that they should look for facilities in their area.

6. Follow-up Care Instructions: Provide detailed guidance on follow-up care specific to this condition.

7. Warning Signs: List important warning signs that ${data.patientName || 'the patient'} should watch for that would indicate worsening of their specific condition.

${medicalAidInfo ? `8. Status Update: Acknowledge the existing medical aid request and its current status. Reassure the patient about what to expect next.` : ''}

Please be specific, practical, and personalized in your advice. If the condition is critical, emphasize the urgency of seeking immediate medical attention. Always address ${data.patientName || 'the patient'} directly to make the advice feel personal.`;

      // Call OpenAI API with retry logic
      const messages = [
            { 
              role: "system", 
          content: "You are Dr. Chopper, a medical professional providing specific medical advice. Your responses should be personalized, addressing the patient by name, and providing specific medical recommendations based on their condition and location. Focus on practical first aid, specific medication names and dosages, and clear emergency care instructions. Always prioritize patient safety and emphasize seeking professional medical help when needed." 
        },
        { role: "user", content: prompt }
      ];
      
      try {
        // Use the retry function
        const responseContent = await callOpenAIWithRetry(messages);

      // Add the bot response
      setMessages(prevMessages => [
        ...prevMessages,
        { 
          type: 'bot', 
            content: responseContent
          }
        ]);
        
        // If we found a medical aid request but it wasn't mentioned in the prompt,
        // add it as a separate system message
        if (medicalAidInfo && !prompt.includes("Existing Medical Aid Request Information")) {
          const medicalAidInfoContent = formatMedicalAidInfo(medicalAidInfo);
          setMessages(prevMessages => [
            ...prevMessages,
            { 
              type: 'system', 
              content: `I found your medical aid request in our system:\n\n${medicalAidInfoContent}` 
            }
          ]);
        }
      } catch (apiError) {
        // We'll handle this in the outer catch block
        throw apiError;
      }
    } catch (error) {
      console.error('Error generating advice:', error);
      
      // Check if the API key is valid or missing
      if (!process.env.REACT_APP_HUGGINGFACE_API_KEY && !process.env.HUGGING_FACE_API_KEY) {
        console.error('Invalid or missing Hugging Face API key');
      }
      
      let errorMessage = "I'm sorry, I couldn't connect to my medical database. ";
      let useLocalLLM = false;
      
      // Add improved error handling for the OpenAI package's error format
      if (error.status === 429 || 
          (error.error && error.error.type === 'rate_limit_exceeded') ||
          (error.message && error.message.includes('rate limit'))) {
        errorMessage = "I'm currently experiencing high demand and have reached my rate limit. I've tried multiple times but the service is unavailable right now. Using local knowledge instead. ";
        useLocalLLM = true;
      } else if (error.status === 401 || error.status === 403 || 
                (error.error && error.error.type === 'invalid_request_error')) {
        errorMessage = "I'm having authentication issues with my medical database. Using local knowledge instead. ";
        useLocalLLM = true;
      } else if (error.status >= 500 || 
                (error.error && error.error.type === 'server_error')) {
        errorMessage = "My medical database is currently experiencing technical difficulties. Using local knowledge instead. ";
        useLocalLLM = true;
      } else if (!error.status && error.message && error.message.includes('API key')) {
        errorMessage = "My medical database connection is not properly configured. Using local knowledge instead. ";
        useLocalLLM = true;
      } else if (!error.status && (!error.response || !error.request)) {
        // Network error or client-side error
        errorMessage = "I couldn't reach my medical database due to network issues. Using local knowledge instead. ";
        useLocalLLM = true;
      }
      
      // Use local LLM or fallback advice when API call fails
      let advice;
      if (useLocalLLM) {
        advice = generateLocalMedicalAdvice(data);
      } else {
        advice = getFirstAidAdvice(data.condition || data.additionalInfo);
      }
      
      const patientName = data.patientName ? `${data.patientName}, ` : '';
      
      setMessages(prevMessages => [
        ...prevMessages,
        { 
          type: 'bot', 
          content: `${patientName}${errorMessage}\n\n${advice}\n\nIMPORTANT: This is general advice only. Please seek professional medical help immediately if your condition is serious or worsening.` 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = inputValue.trim();
    setMessages(prevMessages => [
      ...prevMessages,
      { type: 'user', content: userMessage }
    ]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Check if this is a simple greeting that doesn't need API call
      if (isSimpleGreeting(userMessage)) {
        // Use a predefined response instead of calling the API
        const greeting = getGreetingResponse(userMessage);
        setMessages(prevMessages => [
          ...prevMessages,
          { type: 'bot', content: greeting }
        ]);
        setIsLoading(false);
        return;
      }
      
      // Continue with normal processing for non-greeting messages
      // Extract any potential information from previous messages
      const extractedInfo = {
        patientName: '',
        location: '',
        condition: '',
        additionalInfo: userMessage
      };
      
      // Check for "My name is..." or similar patterns to identify the patient name
      const namePatterns = [
        /my name is ([A-Za-z]+)/i,
        /i am ([A-Za-z]+)/i,
        /i'm ([A-Za-z]+)/i,
        /this is ([A-Za-z]+)/i,
        /([A-Za-z]+) here/i,
        /name:? ([A-Za-z]+)/i
      ];
      
      let extractedName = '';
      
      // Check current message for name mentions
      for (const pattern of namePatterns) {
        const match = userMessage.match(pattern);
        if (match && match[1]) {
          extractedName = match[1];
          break;
        }
      }
      
      // Also try to extract name from conversation history
      if (!extractedName) {
        messages.forEach(msg => {
          if (msg.type === 'user' && !extractedName) {
            for (const pattern of namePatterns) {
              const match = msg.content.match(pattern);
              if (match && match[1]) {
                extractedName = match[1];
                break;
              }
            }
          }
        });
      }
      
      // If a name was mentioned, check for any medical aid requests
      let medicalAidInfo = null;
      if (extractedName) {
        const medicalAidResponse = await fetchMedicalAidByName(extractedName);
        if (medicalAidResponse.success && medicalAidResponse.data && medicalAidResponse.data.length > 0) {
          medicalAidInfo = medicalAidResponse.data[0]; // Get the most recent request
          console.log('Found medical aid request:', medicalAidInfo);
          extractedInfo.patientName = extractedName;
        }
      }
      
      // Try to extract location and other info from message
      const locationMatch = userMessage.match(/(?:in|at|near|from) ([A-Za-z\s]+)(?:\.|,|\s|$)/i);
      if (locationMatch && locationMatch[1]) {
        extractedInfo.location = locationMatch[1].trim();
      }
      
      const conditionMatches = userMessage.match(/(?:have|has|suffering from|diagnosed with) ([A-Za-z\s]+)/i);
      if (conditionMatches && conditionMatches[1]) {
        extractedInfo.condition = conditionMatches[1].trim();
      }

      const conversationHistory = messages.map(msg => {
        if (msg.type === 'bot') return { role: "assistant", content: msg.content };
        if (msg.type === 'user') return { role: "user", content: msg.content };
        return null;
      }).filter(Boolean);

      conversationHistory.push({ role: "user", content: userMessage });

      // If we found a medical aid request, add context for the LLM about it
      if (medicalAidInfo) {
        const medicalAidContext = formatMedicalAidInfo(medicalAidInfo);
        conversationHistory.push({ 
          role: "system", 
          content: `The patient ${extractedName} has an existing medical aid request in our system. Here are the details:\n\n${medicalAidContext}\n\nPlease incorporate this information into your response and provide relevant updates and advice.` 
        });
      }

      const apiMessages = [
            { 
              role: "system", 
          content: `You are Dr. Chopper, a medical professional providing specific medical advice. Your responses should be personalized${extractedInfo.patientName ? ` (addressing ${extractedInfo.patientName} by name)` : ''} and providing specific medical recommendations based on the condition and ${extractedInfo.location ? `location (${extractedInfo.location})` : 'location'}. Focus on practical first aid, specific medication names and dosages, and clear emergency care instructions. Always prioritize patient safety and emphasize seeking professional medical help when needed.` 
        },
        ...conversationHistory
      ];

      try {
        // Use the retry function
        const responseContent = await callOpenAIWithRetry(apiMessages);

      setMessages(prevMessages => [
        ...prevMessages,
        { 
          type: 'bot', 
            content: responseContent 
          }
        ]);
        
        // If we found a medical aid request but didn't include it in the conversation yet,
        // add it as a separate system message
        if (medicalAidInfo && !conversationHistory.some(msg => 
            msg.role === "system" && msg.content.includes("existing medical aid request"))) {
          const medicalAidInfoContent = formatMedicalAidInfo(medicalAidInfo);
          setMessages(prevMessages => [
            ...prevMessages,
            { 
              type: 'system', 
              content: `I found your medical aid request in our system:\n\n${medicalAidInfoContent}` 
            }
          ]);
        }
      } catch (apiError) {
        // We'll handle this in the outer catch block
        throw apiError;
      }
    } catch (error) {
      console.error('Error communicating with chatbot:', error);
      
      let errorMessage = "I'm having trouble connecting to my medical database. ";
      let useLocalLLM = false;
      
      // Improved error handling for OpenAI package's error format
      if (error.status === 429 || 
          (error.error && error.error.type === 'rate_limit_exceeded') ||
          (error.message && error.message.includes('rate limit'))) {
        errorMessage = "I'm currently experiencing high demand and have reached my rate limit. I've tried multiple times but the service is unavailable right now. Using local knowledge instead. ";
        useLocalLLM = true;
      } else if (error.status === 401 || error.status === 403 || 
                (error.error && error.error.type === 'invalid_request_error')) {
        errorMessage = "I'm having authentication issues with my medical database. Using local knowledge instead. ";
        useLocalLLM = true;
      } else if (error.status >= 500 || 
                (error.error && error.error.type === 'server_error')) {
        errorMessage = "My medical database is currently experiencing technical difficulties. Using local knowledge instead. ";
        useLocalLLM = true;
      } else if (!error.status && error.message && error.message.includes('API key')) {
        errorMessage = "My medical database connection is not properly configured. Using local knowledge instead. ";
        useLocalLLM = true;
      } else if (!error.status && (!error.response || !error.request)) {
        // Network error or client-side error
        errorMessage = "I couldn't reach my medical database due to network issues. Using local knowledge instead. ";
        useLocalLLM = true;
      }
      
      // Extract potential name and location from the user message
      const nameMatch = userMessage.match(/(?:name is|I am|I'm) ([A-Za-z]+)/i);
      const locationMatch = userMessage.match(/(?:in|at|near|from) ([A-Za-z\s]+)(?:\.|,|\s|$)/i);
      
      // Use local LLM or fallback advice
      let advice;
      if (useLocalLLM) {
        // Create a data object from the user message with any extracted information
        const messageData = {
          condition: userMessage,
          additionalInfo: userMessage,
          urgency: 'medium', // Default urgency
          patientName: nameMatch ? nameMatch[1] : '',
          location: locationMatch ? locationMatch[1].trim() : ''
        };
        advice = generateLocalMedicalAdvice(messageData);
      } else {
        advice = getFirstAidAdvice(userMessage);
      }
      
      // Add personalized greeting if name was extracted
      const greeting = nameMatch ? `${nameMatch[1]}, ` : '';
      
      setMessages(prevMessages => [
        ...prevMessages,
        { 
          type: 'bot', 
          content: `${greeting}${errorMessage}\n\n${advice}\n\nIMPORTANT: This is general advice only. Please seek professional medical help immediately if your condition is serious or worsening.` 
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new method to explicitly trigger advice generation and open the ChatBot
  const triggerAdvice = (data) => {
    if (!isOpen) {
      setIsOpen(true);
    }
    
    // Use setTimeout to ensure the ChatBot is open before generating advice
    setTimeout(() => generateAdvice(data), 100);
  };

  // Add function to reset the chat history if needed
  const resetChat = () => {
    // Generate a new session ID to avoid loading old messages
    const newSessionId = `session_${Date.now()}`;
    chatSessionId.current = newSessionId;
    localStorage.setItem('chatbot_session_id', newSessionId);
    
    // Reset sessionStorage flag to treat this as a new session
    sessionStorage.removeItem('chatbot_initialized');
    
    // Clear any old message data from localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('chatbot_messages_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Set initial message
    const initialMessage = { 
      type: 'bot', 
      content: 'Hello! I\'m Dr. Chopper. I can analyze your medical condition and provide specific advice about medicines, first aid, and hospital recommendations. How can I help you today?' 
    };
    
    // Update state and localStorage with initial message
    setMessages([initialMessage]);
    localStorage.setItem(`chatbot_messages_${newSessionId}`, JSON.stringify([initialMessage]));
    
    // Close the chat window
    setIsOpen(false);
    localStorage.setItem('chatbot_isOpen', 'false');
  };

  // Expose the triggerAdvice method
  useImperativeHandle(ref, () => ({
    triggerAdvice,
    resetChat // Expose the reset function
  }));

  // Helper function to check if a message is a simple greeting
  const isSimpleGreeting = (message) => {
    const greetingPatterns = [
      /^hi$/i, 
      /^hello$/i, 
      /^hey$/i, 
      /^greetings$/i, 
      /^howdy$/i,
      /^hi there$/i,
      /^hello there$/i,
      /^good morning$/i,
      /^good afternoon$/i,
      /^good evening$/i,
      /^hey there$/i,
      /^hi dr\.? chopper$/i,
      /^hello dr\.? chopper$/i
    ];
    
    return greetingPatterns.some(pattern => pattern.test(message.trim()));
  };

  // Get appropriate greeting response
  const getGreetingResponse = (message) => {
    const responses = [
      "Hello! I'm Dr. Chopper. How can I help with your medical questions today?",
      "Hi there! I'm Dr. Chopper, your medical assistant. What health concerns can I help you with?",
      "Greetings! Dr. Chopper here. How may I assist you with medical advice today?",
      "Hello! This is Dr. Chopper. How can I provide medical assistance today?",
      "Hi! I'm Dr. Chopper. Please let me know if you have any medical questions or concerns."
    ];
    
    // Get a consistent response based on the message to avoid randomness
    const responseIndex = Math.abs(message.length) % responses.length;
    return responses[responseIndex];
  };

  return (
    <div className="chatbot-container">
      {/* Chat toggle button */}
      <button 
        className="chatbot-toggle"
        onClick={toggleChat}
      >
        <img src={chopperImage} alt="Dr. Chopper" />
        <span className="chat-label">Dr. Chopper</span>
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <img src={chopperImage} alt="Dr. Chopper" className="chatbot-avatar" />
            <div className="chatbot-header-info">
              <h3>Dr. Chopper</h3>
              <p>Medical Assistant</p>
            </div>
            <button 
              className="reset-button" 
              onClick={(e) => {
                e.stopPropagation();
                resetChat();
              }}
              title="Reset Chat"
            >
              ↺
            </button>
            <button className="close-button" onClick={toggleChat}>×</button>
          </div>
          
          <div className="chatbot-messages">
            {messages.filter(message => message.type !== 'system').map((message, index) => (
              <div key={index} className={`message ${message.type}`}>
                {message.type === 'bot' && (
                  <img src={chopperImage} alt="Dr. Chopper" className="message-avatar" />
                )}
                <div className="message-content">{message.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message bot">
                <img src={chopperImage} alt="Dr. Chopper" className="message-avatar" />
                <div className="message-content typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form className="chatbot-input" onSubmit={handleSubmit}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !inputValue.trim()}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
});

export default ChatBot;