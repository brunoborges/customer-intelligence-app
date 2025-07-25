// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const XLSX = require('xlsx');
const path = require('path');
const { EmailTemplateEngine, SAMPLE_PRODUCT_OFFERS } = require('./email-engine');
const AIProductManager = require('./ai-product-manager');
const ProductDatabase = require('./product-database');

const app = express();
// Use port 3000 in production when behind Nginx proxy, otherwise default to 3000
const PORT = process.env.PORT || 3000;

// Generate random password for admin user
function generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

// Authentication credentials with random password
const ADMIN_PASSWORD = generateRandomPassword();
const AUTH_CREDENTIALS = {
    username: 'admin',
    password: ADMIN_PASSWORD
};

// Print login credentials to console
console.log('🔐 Admin Login Credentials:');
console.log(`   Username: ${AUTH_CREDENTIALS.username}`);
console.log(`   Password: ${AUTH_CREDENTIALS.password}`);
console.log('   Please save these credentials securely!');

// Session configuration
app.use(session({
    secret: 'customer-bank-secret-key-2025', // In production, use environment variable
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For form parsing

// Initialize email engine, AI manager, product database, and AI tip generator
const emailEngine = new EmailTemplateEngine();
const aiProductManager = new AIProductManager();
const productDatabase = new ProductDatabase();
const AITipGenerator = require('./ai-tip-generator');
const aiTipGenerator = new AITipGenerator();

// Email preview cache - stores generated emails to avoid regenerating them
const emailPreviewCache = new Map();

// Cache helper functions
function getCacheKey(customerId, productId) {
    return `${customerId}-${productId}`;
}

function getCachedEmail(customerId, productId) {
    const key = getCacheKey(customerId, productId);
    const cached = emailPreviewCache.get(key);
    if (cached && Date.now() - cached.timestamp < 60 * 60 * 1000) { // 1 hour expiry
        return cached.email;
    }
    return null;
}

function setCachedEmail(customerId, productId, email) {
    const key = getCacheKey(customerId, productId);
    emailPreviewCache.set(key, {
        email: email,
        timestamp: Date.now()
    });
}

// Initialize sample products if database is empty
const stats = productDatabase.getStatistics();
if (stats.total === 0) {
    console.log('📦 Initializing database with sample products...');
    Object.entries(SAMPLE_PRODUCT_OFFERS).forEach(([key, product]) => {
        const dbProduct = {
            id: product.id || key, // Use key as fallback ID
            name: product.name,
            type: product.type || 'loan', // Add default type
            description: product.details ? product.details.substring(0, 200) + '...' : 'Financial product',
            detailedDescription: product.details || '',
            terms: {
                interestRate: '6.99% APR',
                minimumAmount: '$1,000',
                maximumAmount: '$50,000',
                termLength: '2-7 years'
            },
            expiryDate: product.expiryDate,
            offerCode: product.offerCode,
            campaign: product.campaign,
            status: 'active',
            metadata: {
                source: 'sample_data',
                version: '1.0'
            }
        };
        productDatabase.addProduct(dbProduct);
    });
    console.log('✅ Sample products added to database');
}

// Authentication middleware
function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    } else {
        if (req.path.startsWith('/api/')) {
            // For API routes, return JSON error
            return res.status(401).json({ 
                success: false, 
                error: 'Authentication required',
                redirectTo: '/login'
            });
        } else {
            // For page routes, redirect to login
            return res.redirect('/login');
        }
    }
}

// Login routes (unprotected)
app.get('/login', (req, res) => {
    if (req.session && req.session.authenticated) {
        return res.redirect('/');
    }
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🏦 Customer Bank - Login</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .login-container {
            background: rgba(255, 255, 255, 0.95);
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.3);
            max-width: 400px;
            width: 100%;
        }
        
        .login-header {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .login-header h1 {
            color: #333;
            font-size: 2rem;
            margin-bottom: 10px;
        }
        
        .login-header p {
            color: #666;
            font-size: 1rem;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #333;
            font-weight: 500;
        }
        
        .form-group input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 10px;
            font-size: 1rem;
            transition: border-color 0.3s ease;
        }
        
        .form-group input:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .login-button {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease;
        }
        
        .login-button:hover {
            transform: translateY(-2px);
        }
        
        .error-message {
            background: #ff6b6b;
            color: white;
            padding: 10px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-header">
            <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 15px;">
                <div style="font-size: 60px; margin-bottom: 20px;">🏦</div>
                <h1 style="margin: 0;">Customer Bank</h1>
            </div>
            <p>Customer Intelligence Platform</p>
        </div>
        
        ${req.query.error ? '<div class="error-message">Invalid username or password</div>' : ''}
        
        <form action="/login" method="POST">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <button type="submit" class="login-button">Login</button>
        </form>
    </div>
</body>
</html>
    `);
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    if (username === AUTH_CREDENTIALS.username && password === AUTH_CREDENTIALS.password) {
        req.session.authenticated = true;
        req.session.username = username;
        console.log(`✅ User authenticated: ${username}`);
        res.redirect('/');
    } else {
        console.log(`❌ Failed login attempt: ${username}`);
        res.redirect('/login?error=1');
    }
});

app.post('/logout', (req, res) => {
    const username = req.session.username;
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        } else {
            console.log(`👋 User logged out: ${username}`);
        }
        res.redirect('/login');
    });
});

// Authentication status endpoint (accessible without auth)
app.get('/api/auth-status', (req, res) => {
    res.json({
        authenticated: !!(req.session && req.session.authenticated),
        username: req.session?.username || null
    });
});

// Public routes (no authentication required)
app.get('/offer-accepted', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'offer-accepted.html'));
});

// Analytics endpoint for tracking offer acceptances
app.post('/api/track-offer-acceptance', (req, res) => {
    try {
        const acceptanceData = req.body;
        const timestamp = new Date().toISOString();
        
        console.log(`📈 Offer Acceptance Tracked:`, {
            timestamp,
            product: acceptanceData.product,
            offerCode: acceptanceData.offerCode,
            customer: acceptanceData.customer,
            userAgent: acceptanceData.userAgent
        });
        
        // In a real application, you would save this to a database
        // For now, we just log it and return success
        
        res.json({
            success: true,
            message: 'Offer acceptance tracked successfully',
            timestamp: timestamp
        });
        
    } catch (error) {
        console.error('❌ Error tracking offer acceptance:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to track offer acceptance'
        });
    }
});

// Protected routes start here
// Apply authentication middleware to all routes except login/logout
app.use((req, res, next) => {
    // Skip authentication for login routes, offer acceptance, and static files
    if (req.path === '/login' || 
        req.path.startsWith('/login') || 
        req.path === '/logout' ||
        req.path === '/offer-accepted' ||
        req.path.startsWith('/offer-accepted') ||
        req.path.startsWith('/api/track-offer-acceptance') ||
        req.path.startsWith('/css/') ||
        req.path.startsWith('/js/') ||
        req.path.startsWith('/images/')) {
        return next();
    }
    
    // Apply authentication to all other routes
    return requireAuth(req, res, next);
});

// Serve specific static files that should be publicly accessible (CSS, JS, images)
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/customers', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'customers.html'));
});

app.get('/api/customers', (req, res) => {
    try {
        const workbook = XLSX.readFile('nudge_customers.xlsx');
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const customers = XLSX.utils.sheet_to_json(worksheet);
        
        res.json(customers);
    } catch (error) {
        console.error('Error reading Excel file:', error);
        res.status(500).json({ error: 'Failed to read customer data' });
    }
});

// Update customer notes
app.post('/api/customers/update-notes', (req, res) => {
    try {
        const { customerEmail, customerId, customerName, notes } = req.body;
        
        console.log(`📝 Updating notes for customer: ${customerName} (${customerEmail})`);
        
        // Read the Excel file
        const workbook = XLSX.readFile('nudge_customers.xlsx');
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const customers = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Find the header row to locate the notes column
        const headerRow = customers[0];
        let notesColumnIndex = headerRow.findIndex(header => 
            header && header.toLowerCase().includes('note')
        );
        
        // If notes column doesn't exist, add it
        if (notesColumnIndex === -1) {
            notesColumnIndex = headerRow.length;
            headerRow.push('notes');
            console.log(`📋 Added notes column at index ${notesColumnIndex}`);
        }
        
        // Find the customer row by email or name
        let customerRowIndex = -1;
        for (let i = 1; i < customers.length; i++) {
            const row = customers[i];
            const rowEmail = row[headerRow.findIndex(h => h && h.toLowerCase().includes('email'))];
            const rowFirstName = row[headerRow.findIndex(h => h && h.toLowerCase().includes('first'))];
            const rowLastName = row[headerRow.findIndex(h => h && h.toLowerCase().includes('last'))];
            
            if (rowEmail === customerEmail || 
                (rowFirstName && rowLastName && 
                 `${rowFirstName} ${rowLastName}`.trim() === customerName.trim())) {
                customerRowIndex = i;
                break;
            }
        }
        
        if (customerRowIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Customer not found in spreadsheet' 
            });
        }
        
        // Update the notes for this customer
        if (!customers[customerRowIndex]) {
            customers[customerRowIndex] = [];
        }
        customers[customerRowIndex][notesColumnIndex] = notes;
        
        // Convert back to worksheet
        const newWorksheet = XLSX.utils.aoa_to_sheet(customers);
        workbook.Sheets[sheetName] = newWorksheet;
        
        // Save the file
        XLSX.writeFile(workbook, 'nudge_customers.xlsx');
        
        console.log(`✅ Notes updated successfully for ${customerName}`);
        
        res.json({ 
            success: true, 
            message: 'Notes updated successfully',
            customer: customerName,
            notes: notes
        });
        
    } catch (error) {
        console.error('❌ Error updating customer notes:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to update customer notes' 
        });
    }
});

// Get available product offers
app.get('/api/product-offers', (req, res) => {
    try {
        const products = productDatabase.getProducts({ active: true });
        const productOffers = {};
        
        products.forEach(product => {
            productOffers[product.id] = product;
        });
        
        res.json(productOffers);
    } catch (error) {
        console.error('Error getting product offers:', error);
        res.status(500).json({ error: 'Failed to get product offers' });
    }
});

// AI Product Management Endpoints

// Generate new financial product using AI
app.post('/api/ai/generate-product', async (req, res) => {
    try {
        const requirements = req.body;
        
        console.log('🤖 Generating product with AI:', requirements);
        
        const product = await aiProductManager.generateFinancialProduct(requirements);
        const success = productDatabase.addProduct(product);
        
        if (success) {
            res.json({
                success: true,
                product: product,
                message: 'Product generated and saved successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to save product to database'
            });
        }
    } catch (error) {
        console.error('Error generating product:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all products with filtering
app.get('/api/products', (req, res) => {
    try {
        const filters = req.query;
        const products = productDatabase.getProducts(filters);
        
        res.json({
            success: true,
            products: products,
            count: products.length
        });
    } catch (error) {
        console.error('Error getting products:', error);
        res.status(500).json({ error: 'Failed to get products' });
    }
});

// Get specific product by ID
app.get('/api/products/:id', (req, res) => {
    try {
        const product = productDatabase.getProduct(req.params.id);
        
        if (product) {
            res.json({
                success: true,
                product: product
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }
    } catch (error) {
        console.error('Error getting product:', error);
        res.status(500).json({ error: 'Failed to get product' });
    }
});

// Update product
app.put('/api/products/:id', (req, res) => {
    try {
        const success = productDatabase.updateProduct(req.params.id, req.body);
        
        if (success) {
            res.json({
                success: true,
                message: 'Product updated successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Product not found or update failed'
            });
        }
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
    try {
        const hardDelete = req.query.hard === 'true';
        const success = productDatabase.deleteProduct(req.params.id, hardDelete);
        
        if (success) {
            res.json({
                success: true,
                message: `Product ${hardDelete ? 'permanently deleted' : 'deactivated'} successfully`
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Product not found or deletion failed'
            });
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Analyze product portfolio with AI
app.post('/api/ai/analyze-portfolio', async (req, res) => {
    try {
        const products = productDatabase.getProducts({ active: true });
        
        if (products.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No active products found to analyze'
            });
        }
        
        console.log('🔍 Analyzing portfolio with AI...');
        const analysis = await aiProductManager.analyzeProductPortfolio(products);
        
        res.json({
            success: true,
            analysis: analysis,
            productsAnalyzed: products.length
        });
    } catch (error) {
        console.error('Error analyzing portfolio:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Generate personalized recommendations with AI
app.post('/api/ai/recommendations', async (req, res) => {
    try {
        const { customerId } = req.body;
        
        if (!customerId) {
            return res.status(400).json({
                success: false,
                error: 'Customer ID is required'
            });
        }
        
        // Load customer data
        const workbook = XLSX.readFile('nudge_customers.xlsx');
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const customers = XLSX.utils.sheet_to_json(worksheet);
        
        const customer = customers.find(c => 
            c.id == customerId || 
            `${c.first_name}_${c.last_name}` === customerId
        );
        
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }
        
        const products = productDatabase.getProducts({ active: true });
        
        console.log(`🎯 Generating recommendations for: ${customer.first_name} ${customer.last_name}`);
        const recommendations = await aiProductManager.generatePersonalizedRecommendations(customer, products);
        
        res.json({
            success: true,
            customer: customer,
            recommendations: recommendations
        });
    } catch (error) {
        console.error('Error generating recommendations:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Generate marketing copy with AI
app.post('/api/ai/marketing-copy', async (req, res) => {
    try {
        const { productId, channel = 'email' } = req.body;
        
        if (!productId) {
            return res.status(400).json({
                success: false,
                error: 'Product ID is required'
            });
        }
        
        const product = productDatabase.getProduct(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Product not found'
            });
        }
        
        console.log(`🎨 Generating ${channel} marketing copy for: ${product.name}`);
        const marketingCopy = await aiProductManager.generateMarketingCopy(product, channel);
        
        res.json({
            success: true,
            product: product,
            marketingCopy: marketingCopy,
            channel: channel
        });
    } catch (error) {
        console.error('Error generating marketing copy:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Search products
app.get('/api/products/search', (req, res) => {
    try {
        const criteria = req.query;
        const results = productDatabase.searchProducts(criteria);
        
        res.json({
            success: true,
            results: results,
            count: results.length,
            criteria: criteria
        });
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: 'Failed to search products' });
    }
});

// Get database statistics
app.get('/api/products/stats', (req, res) => {
    try {
        const stats = productDatabase.getStatistics();
        
        res.json({
            success: true,
            statistics: stats
        });
    } catch (error) {
        console.error('Error getting statistics:', error);
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

// Export products
app.get('/api/products/export/:format', (req, res) => {
    try {
        const format = req.params.format;
        const productIds = req.query.products ? req.query.products.split(',') : null;
        
        const filePath = productDatabase.exportProducts(format, productIds);
        
        res.download(filePath, (err) => {
            if (err) {
                console.error('Error downloading file:', err);
                res.status(500).json({ error: 'Failed to download export file' });
            }
        });
    } catch (error) {
        console.error('Error exporting products:', error);
        res.status(500).json({ error: 'Failed to export products' });
    }
});

// Generate email for a specific customer and product
app.post('/api/generate-email', (req, res) => {
    try {
        const { customerId, productType } = req.body;
        
        if (!customerId || !productType) {
            return res.status(400).json({ error: 'Customer ID and product type are required' });
        }

        // Load customer data
        const workbook = XLSX.readFile('nudge_customers.xlsx');
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const customers = XLSX.utils.sheet_to_json(worksheet);
        
        // Find the specific customer
        const customer = customers.find(c => c.id == customerId || 
            `${c.first_name}_${c.last_name}` === customerId);
        
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get product offer
        const productOffer = SAMPLE_PRODUCT_OFFERS[productType];
        if (!productOffer) {
            return res.status(404).json({ error: 'Product offer not found' });
        }

        // Generate email
        const emailContent = emailEngine.generateEmail(customer, productOffer);
        const preview = emailEngine.previewEmail(customer, productOffer);

        res.json({
            success: true,
            customer: customer,
            productOffer: productOffer,
            preview: preview,
            emailContent: emailContent
        });

    } catch (error) {
        console.error('Error generating email:', error);
        res.status(500).json({ error: error.message });
    }
});

// Preview email template
app.get('/api/email-template', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'email-template.html'));
});

// AI Product Manager interface
app.get('/ai-products', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ai-product-manager.html'));
});

// Intelligent Product Matcher interface
app.get('/intelligent-matcher', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'intelligent-matcher.html'));
});

// Employee AI Nudge interface
app.get('/employee-nudge', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee-nudge.html'));
});

// API endpoint for AI-powered product matching
app.post('/api/ai/match-products', async (req, res) => {
    try {
        const { customers, products } = req.body;

        if (!customers || !Array.isArray(customers) || customers.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Valid customers array is required' 
            });
        }

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Valid products array is required' 
            });
        }

        console.log(`🎯 Starting AI product matching for ${customers.length} customers`);

        // Initialize the intelligent product matcher
        const IntelligentProductMatcher = require('./intelligent-product-matcher');
        const matcher = new IntelligentProductMatcher();

        // Process the matching
        const matches = await matcher.matchCustomersToProducts(customers, products);

        console.log(`✅ AI matching completed: ${matches.filter(m => m.success).length}/${matches.length} successful matches`);

        res.json({
            success: true,
            matches: matches,
            summary: {
                totalProcessed: matches.length,
                successfulMatches: matches.filter(m => m.success).length,
                averageConfidence: matches.filter(m => m.success).length > 0 
                    ? Math.round(matches.filter(m => m.success).reduce((sum, m) => sum + m.recommendation.recommendedProduct.confidenceScore, 0) / matches.filter(m => m.success).length)
                    : 0
            }
        });

    } catch (error) {
        console.error('Error in AI product matching:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API endpoint for sending matched emails
app.post('/api/ai/send-matched-emails', async (req, res) => {
    try {
        const { matches } = req.body;

        console.log(`📧 Received email sending request for ${matches ? matches.length : 0} matches`);

        if (!matches || !Array.isArray(matches) || matches.length === 0) {
            console.log('❌ Invalid matches data:', matches);
            return res.status(400).json({ 
                success: false, 
                error: 'Valid matches array is required' 
            });
        }

        console.log(`📧 Starting email generation and sending for ${matches.length} matched customers`);

        // Initialize the intelligent product matcher and email engine
        const IntelligentProductMatcher = require('./intelligent-product-matcher');
        const matcher = new IntelligentProductMatcher();

        // Step 1: Generate personalized emails
        console.log('📝 Generating personalized email content...');
        const emails = await matcher.generatePersonalizedEmails(matches, emailEngine);
        
        const successfulEmails = emails.filter(e => e.success);
        console.log(`📧 Email generation completed: ${successfulEmails.length}/${emails.length} successful`);

        if (successfulEmails.length === 0) {
            console.log('❌ No emails could be generated');
            return res.status(400).json({
                success: false,
                error: 'No emails could be generated from the provided matches'
            });
        }

        // Step 2: Send emails using Resend
        console.log('📤 Sending emails via Resend API...');
        const emailResults = await matcher.sendEmails(successfulEmails, {
            fromEmail: 'no-reply@noreply.kidsched.com',
            fromName: 'Customer Bank Offers',
            batchSize: 3 // Smaller batches for better progress tracking
        });

        const successCount = emailResults.filter(r => r.success).length;
        const failedCount = emailResults.filter(r => !r.success).length;
        const successfulResults = emailResults.filter(r => r.success);
        
        console.log(`✅ Email sending completed: ${successCount}/${emailResults.length} emails sent successfully via Resend`);
        
        if (successCount > 0) {
            console.log(`📧 Successfully sent email IDs:`, successfulResults.map(r => r.emailId).join(', '));
        }
        
        if (failedCount > 0) {
            console.log(`❌ Failed emails:`, emailResults.filter(r => !r.success).map(r => 
                `${r.customer.first_name} ${r.customer.last_name}: ${r.error}`
            ).join('; '));
        }

        res.json({
            success: true,
            emailResults: emailResults,
            generatedEmails: emails.length,
            summary: {
                totalMatches: matches.length,
                emailsGenerated: emails.filter(e => e.success).length,
                emailsSent: emailResults.length,
                successfulSends: successCount,
                failedSends: emailResults.length - successCount
            }
        });

    } catch (error) {
        console.error('❌ Error sending matched emails:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API endpoint for streaming progress updates
app.post('/api/ai/send-emails-with-progress', async (req, res) => {
    try {
        const { matches } = req.body;

        if (!matches || !Array.isArray(matches) || matches.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Valid matches array is required' 
            });
        }

        // Set up Server-Sent Events
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        const sendProgress = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
            sendProgress({ type: 'start', message: 'Initializing email sending process...', progress: 0 });

            // Initialize the intelligent product matcher and email engine
            const IntelligentProductMatcher = require('./intelligent-product-matcher');
            const matcher = new IntelligentProductMatcher();

            sendProgress({ type: 'progress', message: 'Generating personalized email content...', progress: 10 });

            // Step 1: Generate personalized emails
            const emails = await matcher.generatePersonalizedEmails(matches, emailEngine);
            const successfulEmails = emails.filter(e => e.success);

            sendProgress({ 
                type: 'progress', 
                message: `Email content generated: ${successfulEmails.length}/${emails.length} successful`, 
                progress: 30 
            });

            if (successfulEmails.length === 0) {
                sendProgress({ type: 'error', message: 'No emails could be generated from matches', progress: 0 });
                res.end();
                return;
            }

            sendProgress({ type: 'progress', message: 'Starting email delivery via Resend...', progress: 40 });

            // Step 2: Send emails with progress tracking
            const emailResults = [];
            const batchSize = 3;
            const totalBatches = Math.ceil(successfulEmails.length / batchSize);

            for (let i = 0; i < successfulEmails.length; i += batchSize) {
                const batch = successfulEmails.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;

                sendProgress({ 
                    type: 'progress', 
                    message: `Sending batch ${batchNumber}/${totalBatches} (${batch.length} emails)...`, 
                    progress: 40 + (batchNumber / totalBatches) * 50 
                });

                const batchPromises = batch.map(async (email) => {
                    try {
                        const customerEmail = email.customer.email || 
                            `${email.customer.first_name.toLowerCase()}.${email.customer.last_name.toLowerCase()}@example.com`;
                        
                        console.log(`📤 Sending email to ${email.customer.first_name} ${email.customer.last_name} (${customerEmail})`);
                        console.log(`   Subject: ${email.subject}`);
                        
                        const result = await matcher.resendClient.emails.send({
                            from: 'Customer Bank Offers <no-reply@noreply.kidsched.com>',
                            to: [customerEmail],
                            subject: email.subject,
                            html: email.content,
                            headers: {
                                'X-Customer-ID': email.customer.id || 'unknown',
                                'X-Product-ID': email.personalizedProduct.id,
                                'X-Campaign': email.personalizedProduct.campaign,
                                'X-Offer-Code': email.personalizedProduct.offerCode
                            }
                        });

                        console.log(`✅ Resend API Response for ${email.customer.first_name}:`, JSON.stringify(result, null, 2));
                        console.log(`📧 Email ID: ${result?.data?.id || result?.id || 'unknown'}`);

                        return {
                            customer: email.customer,
                            emailId: result?.data?.id || result?.id || 'unknown',
                            success: true,
                            sentAt: new Date().toISOString(),
                            subject: email.subject,
                            productMatched: email.match.recommendation.recommendedProduct.productName,
                            resendResponse: result
                        };

                    } catch (error) {
                        console.error(`❌ Failed to send email to ${email.customer.first_name} ${email.customer.last_name}:`, error.message);
                        console.error(`❌ Full error details:`, JSON.stringify(error, null, 2));
                        
                        return {
                            customer: email.customer,
                            success: false,
                            error: error.message,
                            errorDetails: error
                        };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                emailResults.push(...batchResults);

                const batchSuccessCount = batchResults.filter(r => r.success).length;
                const batchFailedCount = batchResults.filter(r => !r.success).length;
                
                console.log(`📊 Batch ${batchNumber} completed: ${batchSuccessCount}/${batchResults.length} emails sent successfully`);
                
                if (batchSuccessCount > 0) {
                    const batchEmailIds = batchResults.filter(r => r.success).map(r => r.emailId);
                    console.log(`📧 Batch ${batchNumber} successful email IDs:`, batchEmailIds.join(', '));
                }
                
                if (batchFailedCount > 0) {
                    console.log(`❌ Batch ${batchNumber} failed emails:`, batchResults.filter(r => !r.success).map(r => 
                        `${r.customer.first_name} ${r.customer.last_name}: ${r.error}`
                    ).join('; '));
                }

                const successCount = emailResults.filter(r => r.success).length;
                sendProgress({ 
                    type: 'batch-complete', 
                    message: `Batch ${batchNumber} completed. Total sent: ${successCount}/${emailResults.length}`, 
                    progress: 40 + (batchNumber / totalBatches) * 50,
                    batchResults: batchResults
                });

                // Rate limiting between batches
                if (i + batchSize < successfulEmails.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            const finalSuccessCount = emailResults.filter(r => r.success).length;
            const finalFailedCount = emailResults.filter(r => !r.success).length;
            const finalSuccessfulResults = emailResults.filter(r => r.success);
            
            console.log(`🎉 Email campaign completed! ${finalSuccessCount}/${emailResults.length} emails sent successfully via Resend`);
            
            if (finalSuccessCount > 0) {
                console.log(`📧 Campaign successful email IDs:`, finalSuccessfulResults.map(r => r.emailId).join(', '));
            }
            
            if (finalFailedCount > 0) {
                console.log(`❌ Campaign failed emails:`, emailResults.filter(r => !r.success).map(r => 
                    `${r.customer.first_name} ${r.customer.last_name}: ${r.error}`
                ).join('; '));
            }
            
            sendProgress({ 
                type: 'complete', 
                message: `Email campaign completed! ${finalSuccessCount}/${emailResults.length} emails sent successfully.`, 
                progress: 100,
                results: {
                    emailResults: emailResults,
                    summary: {
                        totalMatches: matches.length,
                        emailsGenerated: emails.filter(e => e.success).length,
                        emailsSent: emailResults.length,
                        successfulSends: finalSuccessCount,
                        failedSends: emailResults.length - finalSuccessCount
                    }
                }
            });

        } catch (error) {
            sendProgress({ type: 'error', message: 'Error: ' + error.message, progress: 0 });
        }

        res.end();

    } catch (error) {
        console.error('Error in streaming email endpoint:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API endpoint for sending individual emails (optimized for single/small batch sending)
app.post('/api/ai/send-individual-emails', async (req, res) => {
    try {
        const { matches } = req.body;

        if (!matches || !Array.isArray(matches) || matches.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Valid matches array is required' 
            });
        }

        console.log(`📧 Sending individual emails for ${matches.length} customers`);

        // Initialize the intelligent product matcher and email engine
        const IntelligentProductMatcher = require('./intelligent-product-matcher');
        const matcher = new IntelligentProductMatcher();

        // Generate and send emails immediately (no batching for individual sends)
        const emails = await matcher.generatePersonalizedEmails(matches, emailEngine);
        const successfulEmails = emails.filter(e => e.success);

        if (successfulEmails.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No emails could be generated from the provided matches'
            });
        }

        // Send emails directly without batching for faster individual sends
        const emailResults = [];
        
        for (const email of successfulEmails) {
            try {
                const customerEmail = email.customer.email || 
                    `${email.customer.first_name.toLowerCase()}.${email.customer.last_name.toLowerCase()}@example.com`;
                
                console.log(`📤 Sending individual email to ${email.customer.first_name} ${email.customer.last_name} (${customerEmail})`);
                console.log(`   Subject: ${email.subject}`);
                console.log(`   Product: ${email.match.recommendation.recommendedProduct.productName}`);
                
                const result = await matcher.resendClient.emails.send({
                    from: 'Customer Bank Offers <no-reply@noreply.kidsched.com>',
                    to: [customerEmail],
                    subject: email.subject,
                    html: email.content,
                    headers: {
                        'X-Customer-ID': email.customer.id || 'unknown',
                        'X-Product-ID': email.personalizedProduct.id,
                        'X-Campaign': email.personalizedProduct.campaign,
                        'X-Offer-Code': email.personalizedProduct.offerCode
                    }
                });

                console.log(`✅ Resend API Response for ${email.customer.first_name}:`, JSON.stringify(result, null, 2));
                console.log(`📧 Email successfully sent with ID: ${result?.data?.id || result?.id || 'unknown'}`);

                emailResults.push({
                    customer: email.customer,
                    emailId: result?.data?.id || result?.id || 'unknown',
                    success: true,
                    sentAt: new Date().toISOString(),
                    subject: email.subject,
                    productMatched: email.match.recommendation.recommendedProduct.productName,
                    resendResponse: result
                });

            } catch (error) {
                console.error(`❌ Failed to send email to ${email.customer.first_name} ${email.customer.last_name}:`, error.message);
                console.error(`❌ Full error details:`, JSON.stringify(error, null, 2));
                
                emailResults.push({
                    customer: email.customer,
                    success: false,
                    error: error.message,
                    errorDetails: error
                });
            }
        }

        const successCount = emailResults.filter(r => r.success).length;
        const failedCount = emailResults.filter(r => !r.success).length;
        const successfulResults = emailResults.filter(r => r.success);
        
        console.log(`✅ Individual email sending completed: ${successCount}/${emailResults.length} emails sent`);
        
        if (successCount > 0) {
            console.log(`📧 Successfully sent email IDs:`, successfulResults.map(r => r.emailId).join(', '));
        }
        
        if (failedCount > 0) {
            console.log(`❌ Failed emails:`, emailResults.filter(r => !r.success).map(r => 
                `${r.customer.first_name} ${r.customer.last_name}: ${r.error}`
            ).join('; '));
        }

        res.json({
            success: true,
            emailResults: emailResults,
            summary: {
                totalMatches: matches.length,
                emailsGenerated: emails.filter(e => e.success).length,
                emailsSent: emailResults.length,
                successfulSends: successCount,
                failedSends: emailResults.length - successCount
            }
        });

    } catch (error) {
        console.error('Error sending individual emails:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Test endpoint for email sending
app.post('/api/test-email', async (req, res) => {
    try {
        console.log('🧪 Testing email sending functionality...');
        
        // Initialize the intelligent product matcher
        const IntelligentProductMatcher = require('./intelligent-product-matcher');
        const matcher = new IntelligentProductMatcher();
        
        console.log('🔧 Resend client initialized:', !!matcher.resendClient);
        
        // Test email
        console.log('📤 Attempting to send test email...');
        const testResult = await matcher.resendClient.emails.send({
            from: 'Customer Bank Test <no-reply@noreply.kidsched.com>',
            to: ['test@example.com'],
            subject: '🏦 Customer Bank - Test Email',
            html: '<h1>Test Email</h1><p>This is a test email from 🏦 Customer Bank.</p>',
        });

        console.log('📧 Resend API returned:', testResult);
        console.log('📧 Type of result:', typeof testResult);
        console.log('📧 Result keys:', testResult ? Object.keys(testResult) : 'null');
        
        res.json({
            success: true,
            message: 'Test email sent successfully',
            result: testResult,
            resultType: typeof testResult,
            resultKeys: testResult ? Object.keys(testResult) : null
        });

    } catch (error) {
        console.error('❌ Test email failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.stack
        });
    }
});

// AI Employee Tip Generation Endpoints

// Generate AI tip for employees
app.post('/api/ai/generate-employee-tip', async (req, res) => {
    try {
        const { category = 'productivity', context = 'banking_industry' } = req.body;
        
        console.log(`🤖 Generating AI employee tip - Category: ${category}, Context: ${context}`);
        
        const tip = await aiTipGenerator.generateEmployeeTip(category, context);
        
        res.json({
            success: true,
            tip: tip,
            message: 'AI tip generated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error generating AI employee tip:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send AI tips to selected employees
app.post('/api/ai/send-employee-tips', async (req, res) => {
    try {
        const { employees, tip } = req.body;
        
        if (!employees || !Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid employees array is required'
            });
        }
        
        if (!tip) {
            return res.status(400).json({
                success: false,
                error: 'Tip content is required'
            });
        }
        
        console.log(`📧 Sending AI tips to ${employees.length} employees`);
        
        // Initialize the intelligent product matcher for email sending
        const IntelligentProductMatcher = require('./intelligent-product-matcher');
        const matcher = new IntelligentProductMatcher();
        
        const emailResults = [];
        
        for (const employee of employees) {
            try {
                const employeeEmail = employee.email;
                const employeeName = `${employee.first_name} ${employee.last_name}`;
                
                console.log(`📤 Sending AI tip to ${employeeName} (${employeeEmail})`);
                
                // Generate personalized email content
                const emailData = aiTipGenerator.generateTipEmail(tip, employee);
                
                console.log(`   Subject: ${emailData.subject}`);
                console.log(`   Category: ${tip.categoryDisplay}`);
                
                const result = await matcher.resendClient.emails.send({
                    from: 'Customer Bank AI Assistant <no-reply@noreply.kidsched.com>',
                    to: [employeeEmail],
                    subject: emailData.subject,
                    html: emailData.html,
                    text: emailData.text,
                    headers: {
                        'X-Employee-ID': employee.id || 'unknown',
                        'X-Employee-Name': employeeName,
                        'X-Tip-Category': tip.category,
                        'X-Tip-ID': tip.id,
                        'X-Campaign': 'ai-tips-employee-nudge'
                    }
                });
                
                console.log(`✅ Resend API Response for ${employeeName}:`, JSON.stringify(result, null, 2));
                console.log(`📧 AI tip email sent with ID: ${result?.data?.id || result?.id || 'unknown'}`);
                
                emailResults.push({
                    employee: employee,
                    emailId: result?.data?.id || result?.id || 'unknown',
                    success: true,
                    sentAt: new Date().toISOString(),
                    subject: emailData.subject,
                    tipCategory: tip.categoryDisplay,
                    resendResponse: result
                });
                
            } catch (error) {
                console.error(`❌ Failed to send AI tip to ${employee.first_name} ${employee.last_name}:`, error.message);
                console.error(`❌ Full error details:`, JSON.stringify(error, null, 2));
                
                emailResults.push({
                    employee: employee,
                    success: false,
                    error: error.message,
                    errorDetails: error
                });
            }
        }
        
        const successCount = emailResults.filter(r => r.success).length;
        const failedCount = emailResults.filter(r => !r.success).length;
        const successfulResults = emailResults.filter(r => r.success);
        
        console.log(`✅ AI tip sending completed: ${successCount}/${emailResults.length} emails sent successfully`);
        
        if (successCount > 0) {
            console.log(`📧 Successfully sent AI tip email IDs:`, successfulResults.map(r => r.emailId).join(', '));
        }
        
        if (failedCount > 0) {
            console.log(`❌ Failed AI tip emails:`, emailResults.filter(r => !r.success).map(r => 
                `${r.employee.first_name} ${r.employee.last_name}: ${r.error}`
            ).join('; '));
        }
        
        res.json({
            success: true,
            emailResults: emailResults,
            tip: tip,
            summary: {
                totalEmployees: employees.length,
                totalSent: emailResults.length,
                successfulSends: successCount,
                failedSends: failedCount,
                tipCategory: tip.categoryDisplay
            }
        });
        
    } catch (error) {
        console.error('❌ Error sending AI tips to employees:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Generate personalized AI tip for a specific employee
app.post('/api/ai/generate-personalized-tip', async (req, res) => {
    try {
        const { employeeId, category = 'productivity' } = req.body;
        
        if (!employeeId) {
            return res.status(400).json({
                success: false,
                error: 'Employee ID is required'
            });
        }
        
        // Load employee data
        const workbook = XLSX.readFile('nudge_customers.xlsx');
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const employees = XLSX.utils.sheet_to_json(worksheet);
        
        const employee = employees.find(emp => 
            emp.id == employeeId || 
            `${emp.first_name}_${emp.last_name}` === employeeId ||
            emp.email === employeeId
        );
        
        if (!employee) {
            return res.status(404).json({
                success: false,
                error: 'Employee not found'
            });
        }
        
        console.log(`🎯 Generating personalized AI tip for: ${employee.first_name} ${employee.last_name}`);
        
        const tip = await aiTipGenerator.generatePersonalizedTip(employee, category);
        
        res.json({
            success: true,
            tip: tip,
            employee: employee,
            message: 'Personalized AI tip generated successfully'
        });
        
    } catch (error) {
        console.error('❌ Error generating personalized AI tip:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint for generating email preview with caching
app.post('/api/ai/preview-email', async (req, res) => {
    try {
        const { match } = req.body;

        if (!match || !match.customer || !match.recommendation) {
            return res.status(400).json({
                success: false,
                error: 'Valid match object with customer and recommendation is required'
            });
        }

        const customer = match.customer;
        const productId = match.recommendation.recommendedProduct.productId || 
                         match.recommendation.recommendedProduct.productName;

        console.log(`📧 Generating email preview for ${customer.first_name} ${customer.last_name} - Product: ${productId}`);

        // Check cache first
        const cachedEmail = getCachedEmail(customer.id || customer.email, productId);
        if (cachedEmail) {
            console.log(`💾 Using cached email for ${customer.first_name} ${customer.last_name}`);
            return res.json({
                success: true,
                email: cachedEmail,
                cached: true,
                message: 'Email preview loaded from cache'
            });
        }

        // Generate new email if not cached
        console.log(`🤖 Generating new email for ${customer.first_name} ${customer.last_name}`);
        
        // Initialize the intelligent product matcher
        const IntelligentProductMatcher = require('./intelligent-product-matcher');
        const matcher = new IntelligentProductMatcher();

        // Generate personalized email
        const emails = await matcher.generatePersonalizedEmails([match], emailEngine);
        
        if (!emails || emails.length === 0 || !emails[0].success) {
            return res.status(500).json({
                success: false,
                error: 'Failed to generate email content'
            });
        }

        const generatedEmail = emails[0];
        
        // Cache the generated email
        setCachedEmail(customer.id || customer.email, productId, generatedEmail);
        console.log(`💾 Email cached for ${customer.first_name} ${customer.last_name}`);

        res.json({
            success: true,
            email: generatedEmail,
            cached: false,
            message: 'Email preview generated and cached successfully'
        });

    } catch (error) {
        console.error('❌ Error generating email preview:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint for sending cached emails
app.post('/api/ai/send-cached-emails', async (req, res) => {
    try {
        const { matches } = req.body;

        if (!matches || !Array.isArray(matches) || matches.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid matches array is required'
            });
        }

        console.log(`📧 Sending cached emails for ${matches.length} customers`);

        // Initialize the intelligent product matcher
        const IntelligentProductMatcher = require('./intelligent-product-matcher');
        const matcher = new IntelligentProductMatcher();

        const emailResults = [];
        
        for (const match of matches) {
            try {
                const customer = match.customer;
                const productId = match.recommendation.recommendedProduct.productId || 
                                 match.recommendation.recommendedProduct.productName;

                // Try to get cached email first
                let email = getCachedEmail(customer.id || customer.email, productId);
                
                if (!email) {
                    console.log(`📝 No cached email found for ${customer.first_name} ${customer.last_name}, generating new one...`);
                    // Generate new email if not cached
                    const emails = await matcher.generatePersonalizedEmails([match], emailEngine);
                    if (emails && emails.length > 0 && emails[0].success) {
                        email = emails[0];
                        // Cache the newly generated email
                        setCachedEmail(customer.id || customer.email, productId, email);
                    } else {
                        throw new Error('Failed to generate email content');
                    }
                } else {
                    console.log(`💾 Using cached email for ${customer.first_name} ${customer.last_name}`);
                }

                // Send the email (cached or newly generated)
                const customerEmail = customer.email || 
                    `${customer.first_name.toLowerCase()}.${customer.last_name.toLowerCase()}@example.com`;
                
                console.log(`📤 Sending email to ${customer.first_name} ${customer.last_name} (${customerEmail})`);
                console.log(`   Subject: ${email.subject}`);
                
                const result = await matcher.resendClient.emails.send({
                    from: 'Customer Bank Offers <no-reply@noreply.kidsched.com>',
                    to: [customerEmail],
                    subject: email.subject,
                    html: email.content,
                    headers: {
                        'X-Customer-ID': customer.id || 'unknown',
                        'X-Product-ID': email.personalizedProduct.id,
                        'X-Campaign': email.personalizedProduct.campaign,
                        'X-Offer-Code': email.personalizedProduct.offerCode,
                        'X-Email-Source': 'cached'
                    }
                });

                console.log(`✅ Cached email sent successfully to ${customer.first_name} with ID: ${result?.data?.id || result?.id || 'unknown'}`);

                emailResults.push({
                    customer: customer,
                    emailId: result?.data?.id || result?.id || 'unknown',
                    success: true,
                    sentAt: new Date().toISOString(),
                    subject: email.subject,
                    productMatched: match.recommendation.recommendedProduct.productName,
                    source: 'cached',
                    resendResponse: result
                });

            } catch (error) {
                console.error(`❌ Failed to send cached email to ${match.customer.first_name} ${match.customer.last_name}:`, error.message);
                
                emailResults.push({
                    customer: match.customer,
                    success: false,
                    error: error.message,
                    source: 'cached'
                });
            }
        }

        const successCount = emailResults.filter(r => r.success).length;
        const failedCount = emailResults.filter(r => !r.success).length;
        
        console.log(`✅ Cached email sending completed: ${successCount}/${emailResults.length} emails sent successfully`);

        res.json({
            success: true,
            emailResults: emailResults,
            summary: {
                totalMatches: matches.length,
                successfulSends: successCount,
                failedSends: failedCount,
                source: 'cached'
            }
        });

    } catch (error) {
        console.error('❌ Error sending cached emails:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint for testing nudging-optimized email generation
app.post('/api/ai/test-nudge-email', async (req, res) => {
    try {
        const { customerId, productType } = req.body;

        if (!customerId) {
            return res.status(400).json({ 
                success: false, 
                error: 'Customer ID is required' 
            });
        }

        console.log(`🧠 Testing nudge email generation for customer ${customerId}...`);

        // Get customer data
        const customers = JSON.parse(fs.readFileSync('nudge_customers.xlsx', 'utf8'));
        const customer = customers.find(c => c.id == customerId);
        
        if (!customer) {
            return res.status(404).json({ 
                success: false, 
                error: 'Customer not found' 
            });
        }

        // Initialize the intelligent product matcher
        const IntelligentProductMatcher = require('./intelligent-product-matcher');
        const matcher = new IntelligentProductMatcher();

        // Create a mock match for testing
        const mockMatch = {
            customer: customer,
            recommendation: {
                recommendedProduct: {
                    productId: 'test-product-001',
                    productName: productType || 'Premium Savings Account',
                    confidenceScore: 95
                },
                reasons: `Based on ${customer.first_name}'s profile and location in ${customer.city}, ${customer.province}, this product aligns perfectly with their financial goals and current life stage.`,
                personalizationInsights: {
                    primaryBenefit: "Higher interest rates for your savings",
                    secondaryBenefits: [
                        "No monthly fees",
                        "24/7 digital banking access",
                        "Exclusive investment opportunities"
                    ]
                },
                offerCustomization: {
                    specialOffer: "Limited time: 2.5% APY for the first 6 months"
                }
            }
        };

        // Generate nudge-optimized email
        const nudgeEmail = await matcher.generateNudgeOptimizedEmail(mockMatch);
        
        console.log(`✅ Nudge email test completed for ${customer.first_name} ${customer.last_name}`);
        
        res.json({
            success: true,
            customer: customer,
            mockMatch: mockMatch,
            nudgeEmail: nudgeEmail,
            message: 'Nudge-optimized email generated successfully'
        });

    } catch (error) {
        console.error('❌ Error testing nudge email generation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`AI Product Manager at http://localhost:${PORT}/ai-products`);
    console.log(`Intelligent Matcher at http://localhost:${PORT}/intelligent-matcher`);
    console.log(`Email template at http://localhost:${PORT}/api/email-template`);
});