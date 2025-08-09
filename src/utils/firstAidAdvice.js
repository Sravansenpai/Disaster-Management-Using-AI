/**
 * First aid advice for common medical emergencies
 * This serves as a fallback when the API connection to OpenAI fails
 */
const firstAidAdvice = {
  // General emergency advice
  'default': `
• Call emergency services (911/102/108) immediately for professional medical help
• Keep the patient calm and still to prevent further injury
• Monitor breathing and consciousness
• Do not give food or water if unconscious or severely injured
• Keep the patient warm with a blanket if available
`,

  // Specific conditions
  'head injury': `
• Keep the person still and lying down with head and shoulders slightly elevated
• Apply an ice pack wrapped in a cloth to reduce swelling
• Monitor for changes in consciousness, confusion, vomiting, or fluid from ears/nose
• Do NOT move the person if you suspect a spinal injury
• Seek immediate medical attention for any head injury
`,

  'injury': `
• Clean wounds with clean water and mild soap
• Apply direct pressure with a clean cloth to stop bleeding
• Elevate the injured area above the level of the heart if possible
• Apply a clean bandage, not too tight
• Seek medical attention for deep wounds, embedded objects, or if bleeding doesn't stop
`,

  'fracture': `
• Immobilize the injured area - don't try to realign the bone
• Apply ice wrapped in a cloth to reduce swelling and pain
• Use a splint or sling if available to stabilize the area
• Do not move the person if you suspect spine, neck, or back fractures
• Seek immediate medical attention
`,

  'chest pain': `
• Call emergency services immediately - this could be a heart attack
• Have the person sit down, rest, and try to remain calm
• Loosen tight clothing
• If the person is not allergic and medical advice permits, they may chew aspirin
• If the person becomes unconscious, begin CPR if you're trained
`,

  'bleeding': `
• Apply direct pressure on the wound with a clean cloth or bandage
• If blood soaks through, add another bandage on top without removing the first
• Elevate the wound above the heart if possible
• For severe bleeding, apply pressure to the artery (pressure point)
• Seek immediate medical attention for severe bleeding
`,

  'burn': `
• Run cool (not cold) water over the burn for 10-15 minutes
• Do not apply ice or break blisters
• Cover loosely with a sterile bandage or clean cloth
• Do not apply ointments, butter, or creamy substances to burns
• Seek medical attention for burns larger than 3 inches, or on face, hands, feet, or genitals
`,

  'unconscious': `
• Check for breathing and pulse
• If not breathing, begin CPR if trained
• Place in recovery position if breathing (on side with head tilted back)
• Do not give food or drink
• Call emergency services immediately
`,

  'breathing problem': `
• Help the person into a comfortable position, usually sitting upright
• Loosen tight clothing around neck or chest
• If the person has asthma medication (inhaler), help them use it
• If the person shows signs of bluish lips or severe distress, seek immediate medical attention
• In case of an allergic reaction, use an epinephrine auto-injector (EpiPen) if available
`,

  'allergic reaction': `
• If the person has an epinephrine auto-injector (EpiPen), help them use it
• Call emergency services immediately for severe reactions
• Help the person stay calm and lie quietly on their back
• Loosen tight clothing and cover with a blanket
• Monitor for signs of shock (pale skin, rapid pulse, dizziness)
`,

  'heart attack': `
• Call emergency services immediately
• Have the person sit down, rest, and try to remain calm
• Loosen tight clothing
• If the person is not allergic and medical advice permits, they may chew aspirin
• If the person becomes unconscious, begin CPR if you're trained
`,

  'stroke': `
• Remember FAST: Face dropping, Arm weakness, Speech difficulties, Time to call emergency services
• Note the time when symptoms first appeared
• Keep the person lying down with head slightly elevated
• Do not give food or drink
• Call emergency services immediately
`,

  'seizure': `
• Clear area around the person to prevent injury
• Do not restrain the person or put anything in their mouth
• Gently roll the person to their side after the seizure ends
• Stay with the person until they are fully conscious
• Call emergency services if the seizure lasts more than 5 minutes or if repeated seizures occur
`,

  'poisoning': `
• Call poison control center immediately (1-800-222-1222 in the US)
• Do not induce vomiting unless instructed by medical professionals
• If poison is on the skin, remove contaminated clothing and rinse skin
• If poison is in the eye, flush with clean water for 15-20 minutes
• Bring the container or substance to the hospital if possible
`,

  'illness': `
• Keep the person comfortable and monitor vital signs
• Provide fluids if the person is conscious and able to swallow
• Use medications as prescribed
• Seek medical attention if symptoms worsen or persist
• Keep the person isolated if contagious illness is suspected
`,

  'diabetes': `
• For low blood sugar (hypoglycemia): give sugar via juice, soft drink, honey if conscious
• For high blood sugar (hyperglycemia): provide water and monitor
• Call emergency services if the person loses consciousness
• Have the person rest and monitor their condition
• Help them access their medication if needed
`,

  'fever': `
• Keep the person comfortable and lightly dressed
• Provide fluids to prevent dehydration
• Use fever-reducing medications as appropriate
• Apply cool cloths to forehead, neck, and wrists
• Seek medical attention for very high fevers or if accompanied by severe symptoms
`
};

/**
 * Get first aid advice based on condition
 * @param {string} condition - The medical condition
 * @return {string} First aid advice for the condition
 */
export const getFirstAidAdvice = (condition) => {
  if (!condition) return firstAidAdvice['default'];
  
  // Normalize condition text for matching
  const normalizedCondition = condition.toLowerCase();
  
  // Check for specific conditions in the text
  for (const [key, advice] of Object.entries(firstAidAdvice)) {
    if (normalizedCondition.includes(key)) {
      return advice;
    }
  }
  
  // Return default advice if no specific condition is matched
  return firstAidAdvice['default'];
};

export default firstAidAdvice; 