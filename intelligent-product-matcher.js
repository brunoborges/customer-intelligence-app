/**
 * Intelligent Product Matching Engine for Customer Bank
 * Uses OpenAI to match customers with optimal financial products
 */

const fs = require('fs');
const { OpenAI } = require('openai');
const { Resend } = require('resend');

class IntelligentProductMatcher {
    constructor() {
        this.openaiClient = null;
        this.resendClient = null;
        this.initializeClients();
    }

    /**
     * Initialize OpenAI and Resend clients
     */
    initializeClients() {
        try {
            // Initialize OpenAI
            const openaiKey = process.env.OPENAI_API_KEY;
            if (!openaiKey) {
                throw new Error('OPENAI_API_KEY environment variable is not set');
            }
            this.openaiClient = new OpenAI({ apiKey: openaiKey });
            
            // Initialize Resend
            const resendKey = process.env.RESEND_API_KEY;
            if (!resendKey) {
                throw new Error('RESEND_API_KEY environment variable is not set');
            }
            this.resendClient = new Resend(resendKey);
            
            console.log('✅ OpenAI and Resend clients initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing clients:', error.message);
            throw new Error('Failed to initialize API clients');
        }
    }

    /**
     * Match customers with optimal financial products using AI
     * @param {Array} customers - Array of customer objects
     * @param {Array} products - Array of available products
     * @returns {Promise<Array>} - Array of matches with recommendations
     */
    async matchCustomersToProducts(customers, products) {
        console.log(`🔍 Matching ${customers.length} customers to ${products.length} products using AI...`);
        
        const matches = [];
        
        for (const customer of customers) {
            try {
                const match = await this.matchSingleCustomer(customer, products);
                matches.push(match);
                
                // Rate limiting - wait 1 second between API calls
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Error matching customer ${customer.first_name} ${customer.last_name}:`, error.message);
                matches.push({
                    customer: customer,
                    success: false,
                    error: error.message
                });
            }
        }
        
        console.log(`✅ Matching completed: ${matches.filter(m => m.success).length}/${matches.length} successful`);
        return matches;
    }

    /**
     * Match a single customer to the best product
     * @param {Object} customer - Customer object
     * @param {Array} products - Available products
     * @returns {Promise<Object>} - Match result
     */
    async matchSingleCustomer(customer, products) {
        const prompt = this.buildMatchingPrompt(customer, products);
        
        try {
            const response = await this.openaiClient.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert financial advisor with 20+ years of experience in matching customers with appropriate financial products. You understand credit profiles, financial needs, demographics, and risk assessment. Provide detailed, actionable recommendations."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 800,
                temperature: 0.3, // Lower temperature for more consistent recommendations
                response_format: { type: "json_object" }
            });

            const matchResult = JSON.parse(response.choices[0].message.content);
            
            return {
                customer: customer,
                success: true,
                recommendation: matchResult,
                matchedAt: new Date().toISOString()
            };

        } catch (error) {
            throw new Error(`AI matching failed: ${error.message}`);
        }
    }

    /**
     * Build the AI prompt for product matching
     * @param {Object} customer - Customer data
     * @param {Array} products - Available products
     * @returns {string} - Generated prompt
     */
    buildMatchingPrompt(customer, products) {
        return `
Analyze this customer profile and recommend the BEST financial product from the available options:

CUSTOMER PROFILE:
Name: ${customer.first_name} ${customer.last_name}
City: ${customer.city || 'Not specified'}
Profile: ${customer.profile || 'No specific profile available'}
${customer.notes ? `
IMPORTANT CUSTOMER NOTES: ${customer.notes}
*** PRIORITY: These customer notes contain specific preferences, requirements, or important context that should be the PRIMARY factor in product matching. Any product recommendations MUST align with these notes. ***` : ''}

AVAILABLE PRODUCTS:
${JSON.stringify(products, null, 2)}

TASK:
As a senior financial advisor, analyze this customer's profile and recommend the most suitable product. Consider:

${customer.notes ? '1. **HIGHEST PRIORITY**: Customer notes - these contain specific needs, preferences, or requirements that MUST be addressed first' : ''}
${customer.notes ? '2.' : '1.'} Customer's likely financial situation based on location and profile
${customer.notes ? '3.' : '2.'} Age demographic and life stage inferences
${customer.notes ? '4.' : '3.'} Income potential and creditworthiness indicators
${customer.notes ? '5.' : '4.'} Product benefits that align with customer needs
${customer.notes ? '6.' : '5.'} Risk factors and eligibility requirements

Provide your recommendation in this JSON format:

{
  "recommendedProduct": {
    "productId": "selected_product_id",
    "productName": "product_name",
    "confidenceScore": 85,
    "matchReason": "Why this product is the best match"
  },
  "customerAnalysis": {
    "estimatedCreditScore": 720,
    "likelyIncome": "$65,000",
    "lifestage": "young professional",
    "financialGoals": ["building credit", "earning rewards"],
    "riskProfile": "moderate"
  },
  "personalizationInsights": {
    "primaryBenefit": "Main benefit to highlight",
    "secondaryBenefits": ["benefit1", "benefit2"],
    "potentialConcerns": ["concern1", "concern2"],
    "communicationTone": "professional and friendly"
  },
  "offerCustomization": {
    "suggestedCreditLimit": "$15,000",
    "recommendedTerms": "24 months",
    "specialOffer": "0% APR for first 6 months",
    "urgency": "limited time offer"
  },
  "alternativeProducts": [
    {
      "productId": "alternative_id",
      "reason": "Why this could also be suitable"
    }
  ],
  "emailSubject": "Personalized email subject line",
  "keyMessaging": [
    "Primary message point",
    "Secondary message point", 
    "Call to action message"
  ]
}

Ensure the recommendation is realistic, compliant, and truly beneficial for the customer.
`;
    }

    /**
     * Generate personalized emails with psychological nudging techniques
     * @param {Array} matches - Array of customer-product matches
     * @param {Object} emailEngine - Email template engine instance
     * @returns {Promise<Array>} - Array of generated emails
     */
    async generatePersonalizedEmails(matches, emailEngine) {
        console.log(`📧 Generating psychologically optimized emails for ${matches.length} matches...`);
        
        const emails = [];
        
        for (const match of matches) {
            if (!match.success) {
                emails.push({
                    customer: match.customer,
                    success: false,
                    error: match.error
                });
                continue;
            }

            try {
                // Generate AI-powered nudge email content
                const nudgeEmail = await this.generateNudgeOptimizedEmail(match);
                
                // Find the full product details
                const productId = match.recommendation.recommendedProduct.productId;
                
                // Create a personalized product object for email generation
                const personalizedProduct = {
                    id: productId,
                    name: match.recommendation.recommendedProduct.productName,
                    details: this.buildPersonalizedProductDetails(match),
                    expiryDate: this.generateOfferExpiry(),
                    offerCode: this.generateOfferCode(match.customer),
                    campaign: 'ai_matched_offers_2025'
                };

                emails.push({
                    customer: match.customer,
                    match: match,
                    subject: nudgeEmail.subject,
                    content: nudgeEmail.htmlContent,
                    personalizedProduct: personalizedProduct,
                    nudgingTechniques: nudgeEmail.nudgingTechniques,
                    nudgeOptimized: true,
                    success: true
                });

                console.log(`✅ NUDGE EMAIL USED for ${match.customer.first_name} - Subject: ${nudgeEmail.subject}`);

            } catch (error) {
                console.error(`❌ Error generating nudge email for ${match.customer.first_name}:`, error.message);
                console.log(`🔄 Falling back to regular email generation for ${match.customer.first_name}...`);
                
                // Fallback to regular email generation
                try {
                    const productId = match.recommendation.recommendedProduct.productId;
                    const personalizedProduct = {
                        id: productId,
                        name: match.recommendation.recommendedProduct.productName,
                        details: this.buildPersonalizedProductDetails(match),
                        expiryDate: this.generateOfferExpiry(),
                        offerCode: this.generateOfferCode(match.customer),
                        campaign: 'ai_matched_offers_2025'
                    };

                    const emailContent = emailEngine.generateEmail(match.customer, personalizedProduct);
                    
                    emails.push({
                        customer: match.customer,
                        match: match,
                        subject: match.recommendation.emailSubject,
                        content: emailContent,
                        personalizedProduct: personalizedProduct,
                        nudgeOptimized: false,
                        success: true,
                        fallbackMode: true
                    });
                    
                    console.log(`✅ FALLBACK EMAIL USED for ${match.customer.first_name} - Subject: ${match.recommendation.emailSubject}`);
                } catch (fallbackError) {
                    console.error(`❌ Fallback email generation also failed for ${match.customer.first_name}:`, fallbackError.message);
                    emails.push({
                        customer: match.customer,
                        success: false,
                        error: fallbackError.message
                    });
                }
            }
        }
        
        const totalEmails = emails.filter(e => e.success).length;
        const nudgeEmails = emails.filter(e => e.success && e.nudgeOptimized === true).length;
        const fallbackEmails = emails.filter(e => e.success && e.fallbackMode === true).length;
        
        console.log(`✅ Nudge-optimized email generation completed: ${totalEmails}/${emails.length} successful`);
        console.log(`📊 Email breakdown: ${nudgeEmails} nudge-optimized, ${fallbackEmails} fallback, ${emails.length - totalEmails} failed`);
        
        return emails;
    }

    /**
     * Generate AI-powered email with psychological nudging techniques
     * @param {Object} match - Customer-product match object
     * @returns {Promise<Object>} - Generated email with nudging techniques
     */
    async generateNudgeOptimizedEmail(match) {
        console.log(`🧠 Generating nudge-optimized email for ${match.customer.first_name} ${match.customer.last_name}...`);
        
        const customer = match.customer;
        const product = match.recommendation.recommendedProduct;
        const reasons = match.recommendation.reasons;
        
        const prompt = `You are an expert behavioral economist and email marketing specialist. 
                        Generate a highly persuasive, psychologically optimized email for a banking 
                        customer using advanced nudging techniques.

CUSTOMER PROFILE:
- Name: ${customer.first_name} ${customer.last_name}
- Location: ${customer.city}, ${customer.province}
- Profile: ${customer.profile ? customer.profile.substring(0, 500) : 'Banking customer'}

RECOMMENDED PRODUCT:
- Product: ${product.productName}
- Confidence Score: ${product.confidenceScore}%
- AI Reasoning: ${match.recommendation.recommendedProduct.matchReason || 'AI-recommended based on customer profile'}

NUDGING TOOLBOX - Apply these psychological principles strategically:

1. COGNITIVE DISSONANCE: Create tension between current financial situation and desired outcomes
2. SOCIAL NORMS: Reference what similar customers/peers are doing
3. STATUS QUO BIAS: Address resistance to change with gentle pushes
4. HYPERBOLIC DISCOUNTING: Emphasize immediate benefits and urgency
5. MESSENGER EFFECT: Use credible authority and expertise
6. DECOUPLING: Separate the decision from the cost/effort

EMAIL REQUIREMENTS:
- Subject line that incorporates nudging principles
- Professional yet compelling tone
- Personalized content based on customer profile
- Scarcity and urgency elements
- Social proof and authority signals
- Clear call-to-action
- Plain text format (no HTML)
- Professional business email structure

CRITICAL: Respond with ONLY the JSON object below, no additional text:

{
  "subject": "Compelling subject line with nudging elements",
  "plainTextContent": "Complete plain text email content with clear structure and professional formatting",
  "nudgingTechniques": ["List of applied techniques"],
  "personalizations": ["List of customer-specific elements"]
}

Generate a persuasive plain text email that naturally incorporates multiple nudging techniques while maintaining banking industry professionalism and compliance standards.`;

        try {
            console.log(`🧠 Calling OpenAI for nudge email generation...`);
            const completion = await this.openaiClient.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert behavioral economist and email marketing specialist for Customer Bank. You create highly effective, psychologically optimized plain text emails that ethically influence customer decisions using proven nudging techniques. You MUST respond with ONLY valid JSON in the exact format specified, with no additional text before or after the JSON."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 2000,
                temperature: 0.7
            });

            const response = completion.choices[0]?.message?.content;
            if (!response) {
                throw new Error('No response generated from OpenAI');
            }

            console.log(`📝 AI Response received, length: ${response.length} chars`);
            console.log(`📝 First 200 chars: ${response.substring(0, 200)}...`);

            // Parse the JSON response - should be much simpler with plain text
            let emailData;
            try {
                emailData = JSON.parse(response);
                console.log(`✅ JSON parsed successfully`);
            } catch (parseError) {
                console.error('❌ JSON Parse Error:', parseError.message);
                console.error('❌ Raw AI response:', response);
                throw new Error(`AI response was not valid JSON: ${parseError.message}`);
            }
            
            // Validate the response structure
            if (!emailData.subject || !emailData.plainTextContent) {
                console.error('❌ Invalid email structure returned from AI');
                console.error('❌ Available fields:', Object.keys(emailData));
                throw new Error('Invalid email structure returned from AI - missing subject or plainTextContent');
            }

            console.log(`✅ Nudge email generated for ${customer.first_name}:`);
            console.log(`   📧 Subject: ${emailData.subject}`);
            console.log(`   🧠 Techniques: ${emailData.nudgingTechniques?.join(', ')}`);
            console.log(`   🎯 Personalizations: ${emailData.personalizations?.join(', ')}`);
            console.log(`   📝 Plain text length: ${emailData.plainTextContent?.length} chars`);
            
            // Convert plain text to simple HTML for email sending
            const htmlContent = this.convertPlainTextToHtml(emailData.plainTextContent, customer, product);
            
            return {
                subject: emailData.subject,
                htmlContent: htmlContent,
                plainTextContent: emailData.plainTextContent,
                nudgingTechniques: emailData.nudgingTechniques,
                personalizations: emailData.personalizations
            };

        } catch (error) {
            console.error(`❌ Error generating nudge email:`, error.message);
            throw new Error(`Failed to generate nudge-optimized email: ${error.message}`);
        }
    }

    /**
     * Build personalized product details for email
     * @param {Object} match - Customer-product match
     * @returns {string} - Personalized product description
     */
    buildPersonalizedProductDetails(match) {
        const recommendation = match.recommendation;
        const customer = match.customer;
        
        let details = `Dear ${customer.first_name},\n\n`;
        details += `Based on your profile, we've identified the perfect financial solution for you: ${recommendation.recommendedProduct.productName}.\n\n`;
        details += `${recommendation.recommendedProduct.matchReason}\n\n`;
        
        details += `Here's what makes this offer special for you:\n`;
        details += `• ${recommendation.personalizationInsights.primaryBenefit}\n`;
        
        recommendation.personalizationInsights.secondaryBenefits.forEach(benefit => {
            details += `• ${benefit}\n`;
        });
        
        if (recommendation.offerCustomization.specialOffer) {
            details += `\nExclusive Offer: ${recommendation.offerCustomization.specialOffer}\n`;
        }
        
        details += `\nThis recommendation is based on our analysis of your profile and current financial products market. We believe this product aligns perfectly with your financial goals and current life stage.`;
        
        return details;
    }

    /**
     * Generate offer expiry date
     * @returns {string} - Formatted expiry date
     */
    generateOfferExpiry() {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30); // 30 days from now
        return expiryDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    /**
     * Generate unique offer code for customer
     * @param {Object} customer - Customer object
     * @returns {string} - Unique offer code
     */
    generateOfferCode(customer) {
        const initials = customer.first_name.charAt(0) + customer.last_name.charAt(0);
        const timestamp = Date.now().toString().slice(-6);
        return `CB${initials}${timestamp}`;
    }

    /**
     * Convert plain text email to HTML with Customer Bank styling
     * @param {string} plainText - Plain text email content
     * @param {Object} customer - Customer object
     * @param {Object} product - Product object
     * @returns {string} - HTML formatted email
     */
    convertPlainTextToHtml(plainText, customer, product) {
        // Generate offer code for this customer
        const offerCode = this.generateOfferCode(customer);
        
        // Escape HTML special characters
        const escapedText = plainText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Convert line breaks to HTML
        const htmlContent = escapedText
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🏦 Customer Bank - Personalized Offer</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px 40px;
            text-align: center;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 2px;
            margin-bottom: 10px;
        }
        .tagline {
            font-size: 14px;
            opacity: 0.9;
            font-weight: 300;
        }
        .content {
            padding: 40px;
        }
        .content p {
            margin-bottom: 16px;
            font-size: 16px;
        }
        .cta-section {
            text-align: center;
            margin: 30px 0;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            text-decoration: none;
            padding: 15px 40px;
            border-radius: 25px;
            font-size: 18px;
            font-weight: bold;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
        }
        .footer {
            background-color: #667eea;
            color: white;
            padding: 20px 40px;
            text-align: center;
            font-size: 14px;
        }
        .footer p {
            margin: 5px 0;
            opacity: 0.9;
        }
        @media only screen and (max-width: 600px) {
            .header, .content, .footer {
                padding: 25px 20px;
            }
            .logo {
                font-size: 28px;
            }
            .cta-button {
                padding: 12px 24px;
                font-size: 16px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">🏦 Customer Bank</div>
            <div class="tagline">Your Financial Future Starts Here</div>
        </div>
        
        <div class="content">
            <p>${htmlContent}</p>
            
            <div class="cta-section">
                <a href="/offer-accepted?customer=${encodeURIComponent(customer.first_name + ' ' + customer.last_name)}&product=${encodeURIComponent(product.productName)}&code=${offerCode}&source=email&campaign=ai_matched_offers" class="cta-button">Accept This Offer</a>
            </div>
        </div>
        
        <div class="footer">
            <p><strong>🏦 Customer Bank</strong> | Member FDIC | Equal Housing Lender</p>
            <p>This email was personalized for ${customer.first_name} ${customer.last_name}</p>
            <p>If you no longer wish to receive these emails, <a href="/unsubscribe?email=${encodeURIComponent(customer.email || 'unknown@email.com')}&customer=${customer.id || 'unknown'}" style="color: #a8c6f0;">unsubscribe here</a></p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Send emails using Resend Batch API
     * @param {Array} emails - Array of generated emails
     * @param {Object} options - Sending options
     * @returns {Promise<Array>} - Array of send results
     */
    async sendEmails(emails, options = {}) {
        console.log(`📬 Sending ${emails.length} personalized emails via Resend Batch API...`);
        
        const fromName = options.fromName || '🏦 Customer Bank';
        const fromEmail = 'no-reply@customerbank.com'; // Use verified domain
        const batchSize = options.batchSize || 100; // Resend supports up to 100 emails per batch
        
        const results = [];
        
        // Filter out emails that failed generation
        const validEmails = emails.filter(email => email.success);
        const failedEmails = emails.filter(email => !email.success);
        
        // Add failed generation emails to results
        failedEmails.forEach(email => {
            results.push({
                customer: email.customer,
                success: false,
                error: email.error || 'Email generation failed'
            });
        });
        
        if (validEmails.length === 0) {
            console.log('⚠️ No valid emails to send');
            return results;
        }
        
        // Process emails in batches using Resend Batch API
        for (let i = 0; i < validEmails.length; i += batchSize) {
            const batch = validEmails.slice(i, i + batchSize);
            console.log(`📤 Sending batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(validEmails.length/batchSize)} (${batch.length} emails)...`);
            
            try {
                // Prepare batch payload for Resend
                const batchPayload = batch.map((email, index) => {
                    const payload = {
                        from: `${fromName} <${fromEmail}>`,
                        to: [email.customer.email],
                        subject: email.subject,
                        html: email.content,
                        headers: {
                            'X-Customer-ID': email.customer.id || 'unknown',
                            'X-Product-ID': email.personalizedProduct.id,
                            'X-Campaign': email.personalizedProduct.campaign,
                            'X-Offer-Code': email.personalizedProduct.offerCode
                        }
                    };
                    
                    console.log(`📧 Batch email ${index + 1}: ${email.customer.first_name} ${email.customer.last_name} (${email.customer.email})`);
                    console.log(`   Subject: ${email.subject}`);
                    console.log(`   Content length: ${email.content.length} chars`);
                    
                    return payload;
                });

                console.log(`📦 Batch payload prepared with ${batchPayload.length} emails`);
                console.log(`🔍 First email in batch:`, JSON.stringify(batchPayload[0], null, 2));

                // Send batch using Resend Batch API
                console.log(`🚀 Calling Resend batch.send()...`);
                const batchResult = await this.resendClient.batch.send(batchPayload);
                
                console.log(`📧 Batch API response received:`, JSON.stringify(batchResult, null, 2));
                console.log(`📧 Response type: ${typeof batchResult}`);
                console.log(`📧 Response keys: ${batchResult ? Object.keys(batchResult) : 'null'}`);

                // Process batch results
                if (batchResult && batchResult.data && batchResult.data.data && Array.isArray(batchResult.data.data)) {
                    console.log(`✅ Processing ${batchResult.data.data.length} batch results...`);
                    
                    batchResult.data.data.forEach((emailResult, index) => {
                        const email = batch[index];
                        
                        console.log(`📮 Result ${index + 1}:`, JSON.stringify(emailResult, null, 2));
                        
                        if (emailResult && emailResult.id) {
                            // Success
                            console.log(`✅ Email sent successfully to ${email.customer.first_name}: ${emailResult.id}`);
                            results.push({
                                customer: email.customer,
                                emailId: emailResult.id,
                                success: true,
                                sentAt: new Date().toISOString(),
                                subject: email.subject,
                                productMatched: email.match.recommendation.recommendedProduct.productName
                            });
                        } else {
                            // Failed
                            const errorMsg = emailResult?.error || emailResult?.message || 'Unknown batch send error';
                            console.error(`❌ Failed to send email to ${email.customer.first_name}:`, errorMsg);
                            console.error(`❌ Full error object:`, JSON.stringify(emailResult, null, 2));
                            results.push({
                                customer: email.customer,
                                success: false,
                                error: errorMsg
                            });
                        }
                    });
                } else if (batchResult && batchResult.error) {
                    // Handle API error response
                    console.error(`❌ Resend API returned error:`, JSON.stringify(batchResult.error, null, 2));
                    throw new Error(`Resend API error: ${batchResult.error.message || JSON.stringify(batchResult.error)}`);
                } else {
                    // Handle unexpected response format
                    console.error(`❌ Unexpected batch response format:`, JSON.stringify(batchResult, null, 2));
                    throw new Error(`Invalid batch response format from Resend API. Expected {data: {data: Array}}, got: ${typeof batchResult}`);
                }

                // Rate limiting between batches (if needed)
                if (i + batchSize < validEmails.length) {
                    console.log('⏳ Waiting 1 second before next batch...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (error) {
                console.error(`❌ Batch send failed with error:`, error);
                console.error(`❌ Error type: ${typeof error}`);
                console.error(`❌ Error message: ${error.message}`);
                console.error(`❌ Error stack: ${error.stack}`);
                
                if (error.response) {
                    console.error(`❌ HTTP Response status: ${error.response.status}`);
                    console.error(`❌ HTTP Response data:`, JSON.stringify(error.response.data, null, 2));
                }
                
                if (error.cause) {
                    console.error(`❌ Error cause:`, JSON.stringify(error.cause, null, 2));
                }
                
                // Mark all emails in this batch as failed
                batch.forEach((email, index) => {
                    console.error(`❌ Marking email ${index + 1} to ${email.customer.first_name} as failed due to batch error`);
                    results.push({
                        customer: email.customer,
                        success: false,
                        error: `Batch send failed: ${error.message}`
                    });
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        console.log(`✅ Email sending completed: ${successCount}/${results.length} emails sent successfully`);
        
        return results;
    }

    /**
     * Complete workflow: match customers to products and send emails
     * @param {Array} customers - Array of customers
     * @param {Array} products - Array of products
     * @param {Object} emailEngine - Email template engine
     * @param {Object} options - Workflow options
     * @returns {Promise<Object>} - Complete workflow results
     */
    async runCompleteWorkflow(customers, products, emailEngine, options = {}) {
        console.log('\n🚀 Starting Complete AI-Powered Product Matching and Email Workflow');
        console.log('=================================================================\n');
        
        const startTime = Date.now();
        
        try {
            // Step 1: Match customers to products
            console.log('Step 1: AI Product Matching');
            const matches = await this.matchCustomersToProducts(customers, products);
            
            // Step 2: Generate personalized emails
            console.log('\nStep 2: Email Generation');
            const emails = await this.generatePersonalizedEmails(matches, emailEngine);
            
            // Step 3: Send emails (if enabled)
            let sendResults = [];
            if (options.sendEmails !== false) {
                console.log('\nStep 3: Email Sending');
                sendResults = await this.sendEmails(emails, options.emailOptions);
            } else {
                console.log('\nStep 3: Skipped (email sending disabled)');
            }
            
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            
            const workflow = {
                success: true,
                summary: {
                    customersProcessed: customers.length,
                    successfulMatches: matches.filter(m => m.success).length,
                    emailsGenerated: emails.filter(e => e.success).length,
                    emailsSent: sendResults.filter(r => r.success).length,
                    duration: `${duration}s`
                },
                matches: matches,
                emails: emails,
                sendResults: sendResults,
                completedAt: new Date().toISOString()
            };
            
            console.log('\n📊 Workflow Summary:');
            console.log(`   Customers processed: ${workflow.summary.customersProcessed}`);
            console.log(`   Successful matches: ${workflow.summary.successfulMatches}`);
            console.log(`   Emails generated: ${workflow.summary.emailsGenerated}`);
            console.log(`   Emails sent: ${workflow.summary.emailsSent}`);
            console.log(`   Total duration: ${workflow.summary.duration}`);
            console.log('\n🎉 Workflow completed successfully!');
            
            return workflow;
            
        } catch (error) {
            console.error('❌ Workflow failed:', error.message);
            throw error;
        }
    }

    /**
     * Save workflow results to file
     * @param {Object} workflow - Workflow results
     * @param {string} filename - Output filename
     */
    saveWorkflowResults(workflow, filename = null) {
        if (!filename) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            filename = `ai_matching_workflow_${timestamp}.json`;
        }
        
        try {
            fs.writeFileSync(filename, JSON.stringify(workflow, null, 2));
            console.log(`💾 Workflow results saved to: ${filename}`);
            return filename;
        } catch (error) {
            console.error('❌ Error saving workflow results:', error.message);
            throw error;
        }
    }
}

module.exports = IntelligentProductMatcher;
