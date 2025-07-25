/**
 * AI-Powered Financial Product Manager for Customer Bank
 * Uses OpenAI to generate, analyze, and manage financial products
 */

const fs = require('fs');
const { OpenAI } = require('openai');

class AIProductManager {
    constructor() {
        this.client = null;
        this.initializeOpenAI();
    }

    /**
     * Initialize OpenAI client with API key
     */
    initializeOpenAI() {
        try {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error('OPENAI_API_KEY environment variable is not set');
            }
            this.client = new OpenAI({ apiKey });
            console.log('✅ OpenAI client initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing OpenAI:', error.message);
            throw new Error('Failed to initialize OpenAI client');
        }
    }

    /**
     * Generate a new financial product using OpenAI
     * @param {Object} requirements - Product requirements and specifications
     * @returns {Promise<Object>} - Generated product details
     */
    async generateFinancialProduct(requirements) {
        const prompt = this.buildProductGenerationPrompt(requirements);
        
        try {
            const response = await this.client.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a senior financial product manager at Customer Bank with 15+ years of experience creating competitive financial products. You understand market trends, regulatory requirements, and customer needs. Generate detailed, realistic financial products that are compliant and market-competitive."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            const generatedProduct = JSON.parse(response.choices[0].message.content);
            
            // Add metadata
            generatedProduct.metadata = {
                generatedAt: new Date().toISOString(),
                generatedBy: 'OpenAI GPT-4',
                version: '1.0',
                status: 'draft'
            };

            console.log(`✅ Generated product: ${generatedProduct.name}`);
            return generatedProduct;

        } catch (error) {
            console.error('❌ Error generating product:', error.message);
            throw new Error(`Failed to generate product: ${error.message}`);
        }
    }

    /**
     * Build the prompt for product generation
     * @param {Object} requirements 
     * @returns {string} - Generated prompt
     */
    buildProductGenerationPrompt(requirements) {
        return `
Generate a detailed financial product for Customer Bank based on these requirements:

Product Type: ${requirements.type || 'Not specified'}
Target Market: ${requirements.targetMarket || 'General consumers'}
Key Features: ${requirements.features || 'Competitive rates and terms'}
Budget Range: ${requirements.budgetRange || 'Standard pricing'}
Special Requirements: ${requirements.specialRequirements || 'None'}
Competitive Focus: ${requirements.competitiveFocus || 'Market-standard offerings'}

Please generate a comprehensive financial product specification in JSON format with the following structure:

{
  "id": "unique_product_id",
  "name": "Product Name",
  "type": "product_category",
  "description": "Brief product description",
  "detailedDescription": "Comprehensive product details for marketing",
  "features": [
    "Feature 1",
    "Feature 2",
    "Feature 3"
  ],
  "benefits": [
    "Benefit 1",
    "Benefit 2", 
    "Benefit 3"
  ],
  "terms": {
    "interestRate": "X.XX% APR",
    "minimumAmount": "$X,XXX",
    "maximumAmount": "$XX,XXX",
    "termLength": "X-X years",
    "fees": "Fee structure",
    "eligibilityRequirements": "Requirements list"
  },
  "targetAudience": {
    "primaryMarket": "Target market description",
    "creditScoreRange": "XXX-XXX",
    "incomeRequirement": "$XX,XXX+",
    "demographics": "Age, location, etc."
  },
  "competitiveAdvantages": [
    "Advantage 1",
    "Advantage 2"
  ],
  "marketingCopy": {
    "headline": "Catchy headline",
    "subheadline": "Supporting message",
    "callToAction": "Action phrase"
  },
  "riskAssessment": {
    "riskLevel": "Low/Medium/High",
    "mitigationStrategies": ["Strategy 1", "Strategy 2"]
  },
  "regulatoryCompliance": [
    "Regulation 1",
    "Regulation 2"
  ],
  "launchTimeline": "Estimated timeline",
  "campaign": "suggested_campaign_name",
  "offerCode": "PRODUCT_CODE",
  "expiryDate": "Future date"
}

Ensure all rates, terms, and features are realistic and competitive for the current market. The product should be innovative but compliant with banking regulations.
`;
    }

    /**
     * Analyze existing products and suggest improvements
     * @param {Array} existingProducts - Current product portfolio
     * @returns {Promise<Object>} - Analysis and recommendations
     */
    async analyzeProductPortfolio(existingProducts) {
        const prompt = `
Analyze this financial product portfolio for Customer Bank and provide strategic recommendations:

Current Products:
${JSON.stringify(existingProducts, null, 2)}

Provide a comprehensive analysis in JSON format including:
1. Portfolio strengths and weaknesses
2. Market gap analysis
3. Product recommendations
4. Pricing optimization suggestions
5. Customer segment analysis
6. Competitive positioning advice

Format your response as a JSON object with clear sections and actionable insights.
`;

        try {
            const response = await this.client.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a strategic financial product analyst with expertise in banking, market research, "+
                        "and competitive analysis. Provide data-driven insights and actionable recommendations."

                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 1500,
                temperature: 0.6,
                response_format: { type: "json_object" }
            });

            const analysis = JSON.parse(response.choices[0].message.content);
            analysis.analysisDate = new Date().toISOString();
            
            console.log('✅ Portfolio analysis completed');
            return analysis;

        } catch (error) {
            console.error('❌ Error analyzing portfolio:', error.message);
            throw new Error(`Failed to analyze portfolio: ${error.message}`);
        }
    }

    /**
     * Generate personalized product recommendations for a customer
     * @param {Object} customerProfile - Customer data and preferences
     * @param {Array} availableProducts - Available product catalog
     * @returns {Promise<Object>} - Personalized recommendations
     */
    async generatePersonalizedRecommendations(customerProfile, availableProducts) {
        const prompt = `
Generate personalized financial product recommendations for this Customer Bank customer:

Customer Profile:
${JSON.stringify(customerProfile, null, 2)}

Available Products:
${JSON.stringify(availableProducts, null, 2)}

Provide recommendations in JSON format including:
1. Top 3 recommended products with reasoning
2. Personalized benefits for each recommendation
3. Estimated approval probability
4. Suggested offer terms
5. Next best actions

Consider the customer's financial situation, credit profile, and stated goals.
`;

        try {
            const response = await this.client.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a personal financial advisor with expertise in matching customers "+
                        "with appropriate financial products based on their profiles, needs, and goals."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            const recommendations = JSON.parse(response.choices[0].message.content);
            recommendations.generatedAt = new Date().toISOString();
            recommendations.customerId = customerProfile.id || 'unknown';
            
            console.log(`✅ Generated recommendations for customer: ${customerProfile.first_name} ${customerProfile.last_name}`);
            return recommendations;

        } catch (error) {
            console.error('❌ Error generating recommendations:', error.message);
            throw new Error(`Failed to generate recommendations: ${error.message}`);
        }
    }

    /**
     * Evaluate if a product should be discontinued
     * @param {Object} product - Product to evaluate
     * @param {Object} performanceData - Product performance metrics
     * @returns {Promise<Object>} - Discontinuation recommendation
     */
    async evaluateProductDiscontinuation(product, performanceData) {
        const prompt = `
Evaluate whether this financial product should be discontinued based on its performance:

Product Details:
${JSON.stringify(product, null, 2)}

Performance Data:
${JSON.stringify(performanceData, null, 2)}

Provide a discontinuation analysis in JSON format including:
1. Recommendation (continue/modify/discontinue)
2. Reasoning and supporting data
3. Impact assessment
4. Alternative strategies
5. Timeline recommendations
6. Customer migration plan (if discontinuing)

Be thorough and consider both financial and strategic implications.
`;

        try {
            const response = await this.client.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a senior product manager specializing in financial product lifecycle management. "
                        + "You make data-driven decisions about product continuation based on performance metrics, market conditions, and strategic fit."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.6,
                response_format: { type: "json_object" }
            });

            const evaluation = JSON.parse(response.choices[0].message.content);
            evaluation.evaluationDate = new Date().toISOString();
            evaluation.productId = product.id;
            
            console.log(`✅ Evaluated product: ${product.name}`);
            return evaluation;

        } catch (error) {
            console.error('❌ Error evaluating product:', error.message);
            throw new Error(`Failed to evaluate product: ${error.message}`);
        }
    }

    /**
     * Generate marketing copy for a financial product
     * @param {Object} product - Product details
     * @param {string} channel - Marketing channel (email, web, social, etc.)
     * @returns {Promise<Object>} - Generated marketing materials
     */
    async generateMarketingCopy(product, channel = 'email') {
        const prompt = `
Generate compelling marketing copy for this Customer Bank financial product:

Product:
${JSON.stringify(product, null, 2)}

Marketing Channel: ${channel}

Create marketing materials in JSON format including:
1. Multiple headline options
2. Product descriptions (short and long)
3. Benefit-focused bullet points
4. Call-to-action variations
5. Social proof elements
6. Urgency/scarcity messaging
7. Compliance disclaimers

Ensure the copy is persuasive, compliant, and appropriate for the ${channel} channel.
`;

        try {
            const response = await this.client.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a senior financial services copywriter with expertise in creating compliant, "+
                        "persuasive marketing materials that convert prospects into customers while adhering to banking regulations."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 1200,
                temperature: 0.8,
                response_format: { type: "json_object" }
            });

            const marketingCopy = JSON.parse(response.choices[0].message.content);
            marketingCopy.generatedAt = new Date().toISOString();
            marketingCopy.channel = channel;
            marketingCopy.productId = product.id;
            
            console.log(`✅ Generated ${channel} marketing copy for: ${product.name}`);
            return marketingCopy;

        } catch (error) {
            console.error('❌ Error generating marketing copy:', error.message);
            throw new Error(`Failed to generate marketing copy: ${error.message}`);
        }
    }

    /**
     * Batch process multiple operations
     * @param {Array} operations - Array of operations to perform
     * @returns {Promise<Array>} - Results of all operations
     */
    async batchProcess(operations) {
        console.log(`🔄 Processing ${operations.length} operations...`);
        const results = [];

        for (const operation of operations) {
            try {
                let result;
                switch (operation.type) {
                    case 'generate':
                        result = await this.generateFinancialProduct(operation.requirements);
                        break;
                    case 'analyze':
                        result = await this.analyzeProductPortfolio(operation.products);
                        break;
                    case 'recommend':
                        result = await this.generatePersonalizedRecommendations(
                            operation.customer, 
                            operation.products
                        );
                        break;
                    case 'evaluate':
                        result = await this.evaluateProductDiscontinuation(
                            operation.product, 
                            operation.performanceData
                        );
                        break;
                    case 'marketing':
                        result = await this.generateMarketingCopy(
                            operation.product, 
                            operation.channel
                        );
                        break;
                    default:
                        throw new Error(`Unknown operation type: ${operation.type}`);
                }

                results.push({
                    operation: operation,
                    success: true,
                    result: result
                });

                // Rate limiting - wait 1 second between API calls
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                results.push({
                    operation: operation,
                    success: false,
                    error: error.message
                });
            }
        }

        console.log(`✅ Batch processing completed: ${results.filter(r => r.success).length}/${results.length} successful`);
        return results;
    }
}

module.exports = AIProductManager;
