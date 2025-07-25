/**
 * Email Template Engine for 🏦 Customer Bank Financial Product Offers
 * This module provides functionality to generate personalized email content
 * using the email template and customer data.
 */

const fs = require('fs');
const path = require('path');

class EmailTemplateEngine {
    constructor() {
        this.templatePath = path.join(__dirname, 'public', 'email-template.html');
        this.template = null;
        this.loadTemplate();
    }

    /**
     * Load the email template from file
     */
    loadTemplate() {
        try {
            this.template = fs.readFileSync(this.templatePath, 'utf8');
        } catch (error) {
            console.error('Error loading email template:', error);
            throw new Error('Failed to load email template');
        }
    }

    /**
     * Generate personalized email content
     * @param {Object} customerData - Customer information
     * @param {Object} productOffer - Product offer details
     * @returns {string} - Generated HTML email content
     */
    generateEmail(customerData, productOffer) {
        if (!this.template) {
            throw new Error('Email template not loaded');
        }

        // Validate required data
        this.validateData(customerData, productOffer);

        let emailContent = this.template;

        // Replace customer placeholders
        emailContent = emailContent.replace(/{{customer_name}}/g, 
            `${customerData.first_name} ${customerData.last_name}`);

        // Replace product placeholders
        emailContent = emailContent.replace(/{{product_name}}/g, productOffer.name);
        emailContent = emailContent.replace(/{{product_details}}/g, productOffer.details);
        
        // Replace offer link with tracking parameters
        const offerLink = this.generateOfferLink(customerData, productOffer);
        emailContent = emailContent.replace(/{{offer_link}}/g, offerLink);

        // Replace expiry date
        emailContent = emailContent.replace(/{{expiry_date}}/g, productOffer.expiryDate);

        // Replace unsubscribe and policy links
        emailContent = emailContent.replace(/{{unsubscribe_link}}/g, 
            `https://customerbank.com/unsubscribe?customer_id=${customerData.id || 'unknown'}`);
        emailContent = emailContent.replace(/{{privacy_policy_link}}/g, 
            'https://customerbank.com/privacy-policy');
        emailContent = emailContent.replace(/{{terms_link}}/g, 
            'https://customerbank.com/terms-of-service');

        return emailContent;
    }

    /**
     * Validate required customer and product data
     * @param {Object} customerData 
     * @param {Object} productOffer 
     */
    validateData(customerData, productOffer) {
        // Validate customer data
        if (!customerData.first_name || !customerData.last_name) {
            throw new Error('Customer first_name and last_name are required');
        }

        // Validate product offer data
        if (!productOffer.name || !productOffer.details) {
            throw new Error('Product name and details are required');
        }

        if (!productOffer.expiryDate) {
            throw new Error('Product expiry date is required');
        }
    }

    /**
     * Generate offer link with tracking parameters
     * @param {Object} customerData 
     * @param {Object} productOffer 
     * @returns {string} - Complete offer URL with tracking
     */
    generateOfferLink(customerData, productOffer) {
        // Use environment-aware base URL
        const baseUrl = process.env.NODE_ENV === 'production' 
            ? 'https://customerbank.com/offer-accepted'  // Production server
            : 'http://localhost:3000/offer-accepted'; // Development
            
        const params = new URLSearchParams({
            customer: `${customerData.first_name} ${customerData.last_name}`,
            product: productOffer.name || 'Financial Product',
            code: productOffer.offerCode || 'GENERAL',
            source: 'email',
            campaign: productOffer.campaign || 'default'
        });

        return `${baseUrl}?${params.toString()}`;
    }

    /**
     * Generate email for multiple customers
     * @param {Array} customers - Array of customer objects
     * @param {Object} productOffer - Product offer details
     * @returns {Array} - Array of generated email objects
     */
    generateBulkEmails(customers, productOffer) {
        return customers.map(customer => {
            try {
                const emailContent = this.generateEmail(customer, productOffer);
                return {
                    customer: customer,
                    subject: `Exclusive ${productOffer.name} Offer for ${customer.first_name}`,
                    content: emailContent,
                    success: true
                };
            } catch (error) {
                return {
                    customer: customer,
                    subject: null,
                    content: null,
                    success: false,
                    error: error.message
                };
            }
        });
    }

    /**
     * Preview email content in a simplified format
     * @param {Object} customerData 
     * @param {Object} productOffer 
     * @returns {Object} - Email preview data
     */
    previewEmail(customerData, productOffer) {
        const content = this.generateEmail(customerData, productOffer);
        
        return {
            to: `${customerData.first_name} ${customerData.last_name} <${customerData.email || 'customer@example.com'}>`,
            from: '🏦 Customer Bank <offers@customerbank.com>',
            subject: `Exclusive ${productOffer.name} Offer for ${customerData.first_name}`,
            contentPreview: content.substring(0, 200) + '...',
            fullContent: content,
            estimatedSize: Buffer.byteLength(content, 'utf8'),
            generatedAt: new Date().toISOString()
        };
    }
}

// Example product offers
const SAMPLE_PRODUCT_OFFERS = {
    personalLoan: {
        id: 'PL001',
        name: '🏦 Customer Bank Personal Loan',
        details: `Take advantage of our competitive personal loan with rates as low as 5.99% APR. Whether you're consolidating debt, financing a home improvement project, or covering unexpected expenses, our personal loan offers flexible terms from 2 to 7 years with loan amounts up to $50,000. No collateral required and funds can be available as soon as the next business day after approval.`,
        expiryDate: 'December 31, 2025',
        offerCode: 'PL2025',
        campaign: 'winter_personal_loans'
    },
    creditCard: {
        id: 'CC001',
        name: '🏦 Customer Bank Rewards Credit Card',
        details: `Earn 2% cash back on all purchases with our new 🏦 Customer Bank Rewards Credit Card. Enjoy a 0% intro APR for the first 15 months on purchases and balance transfers, plus no annual fee ever. You'll also receive a $200 welcome bonus after spending $1,000 in the first 3 months. Additional benefits include travel insurance, purchase protection, and 24/7 fraud monitoring.`,
        expiryDate: 'January 15, 2026',
        offerCode: 'CC2025',
        campaign: 'new_year_credit_cards'
    },
    mortgage: {
        id: 'MG001',
        name: '🏦 Customer Bank Home Mortgage',
        details: `Make your homeownership dreams a reality with our competitive mortgage rates starting at 6.25% APR for qualified buyers. We offer conventional, FHA, VA, and jumbo loans with down payments as low as 3%. Our experienced loan officers will guide you through every step of the process, and we can often close in as little as 21 days. First-time homebuyer programs available.`,
        expiryDate: 'March 30, 2026',
        offerCode: 'MG2025',
        campaign: 'spring_home_buying'
    }
};

module.exports = {
    EmailTemplateEngine,
    SAMPLE_PRODUCT_OFFERS
};
