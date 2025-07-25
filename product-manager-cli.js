#!/usr/bin/env node
/**
 * 🏦 Customer Bank AI Product Manager CLI
 * Command-line interface for managing financial products using OpenAI
 */

const AIProductManager = require('./ai-product-manager');
const ProductDatabase = require('./product-database');
const { SAMPLE_PRODUCT_OFFERS } = require('./email-engine');

class ProductManagerCLI {
    constructor() {
        this.aiManager = new AIProductManager();
        this.database = new ProductDatabase();
        this.commands = {
            'generate': this.generateProduct.bind(this),
            'list': this.listProducts.bind(this),
            'delete': this.deleteProduct.bind(this),
            'analyze': this.analyzePortfolio.bind(this),
            'recommend': this.getRecommendations.bind(this),
            'marketing': this.generateMarketing.bind(this),
            'search': this.searchProducts.bind(this),
            'stats': this.showStatistics.bind(this),
            'export': this.exportProducts.bind(this),
            'help': this.showHelp.bind(this)
        };
    }

    /**
     * Main command handler
     */
    async run() {
        const args = process.argv.slice(2);
        
        if (args.length === 0) {
            await this.showInteractiveMenu();
            return;
        }

        const command = args[0].toLowerCase();
        const commandArgs = args.slice(1);

        if (this.commands[command]) {
            try {
                await this.commands[command](commandArgs);
            } catch (error) {
                console.error(`❌ Error executing command '${command}':`, error.message);
                process.exit(1);
            }
        } else {
            console.error(`❌ Unknown command: ${command}`);
            this.showHelp();
            process.exit(1);
        }
    }

    /**
     * Show interactive menu for command selection
     */
    async showInteractiveMenu() {
        console.log('\n🏦 Customer Bank AI Product Manager');
        console.log('================================\n');
        
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const menuOptions = [
            '1. Generate new financial product',
            '2. List all products',
            '3. Delete a product',
            '4. Analyze product portfolio',
            '5. Get customer recommendations',
            '6. Generate marketing copy',
            '7. Search products',
            '8. Show statistics',
            '9. Export products',
            '0. Exit'
        ];

        console.log('Available options:');
        menuOptions.forEach(option => console.log(option));

        const choice = await new Promise(resolve => {
            rl.question('\nSelect an option (0-9): ', resolve);
        });

        rl.close();

        switch (choice) {
            case '1': await this.interactiveGenerate(); break;
            case '2': await this.listProducts([]); break;
            case '3': await this.interactiveDelete(); break;
            case '4': await this.analyzePortfolio([]); break;
            case '5': await this.interactiveRecommendations(); break;
            case '6': await this.interactiveMarketing(); break;
            case '7': await this.interactiveSearch(); break;
            case '8': await this.showStatistics([]); break;
            case '9': await this.exportProducts(['json']); break;
            case '0': console.log('👋 Goodbye!'); break;
            default: console.log('❌ Invalid option'); break;
        }
    }

    /**
     * Generate a new financial product
     */
    async generateProduct(args) {
        console.log('🤖 Generating new financial product using AI...\n');

        // Parse command line arguments or use interactive mode
        let requirements = {};
        
        if (args.length === 0) {
            requirements = await this.getProductRequirements();
        } else {
            // Parse command line format: --type=loan --target="young professionals"
            args.forEach(arg => {
                if (arg.startsWith('--')) {
                    const [key, value] = arg.slice(2).split('=');
                    requirements[key] = value?.replace(/['"]/g, '') || true;
                }
            });
        }

        try {
            const product = await this.aiManager.generateFinancialProduct(requirements);
            
            // Add to database
            const success = this.database.addProduct(product);
            
            if (success) {
                console.log('\n✅ Product generated and saved successfully!\n');
                this.displayProduct(product);
                
                // Ask if user wants to generate marketing copy
                if (await this.askYesNo('Generate marketing copy for this product?')) {
                    const marketing = await this.aiManager.generateMarketingCopy(product, 'email');
                    console.log('\n📧 Marketing Copy Generated:');
                    console.log(JSON.stringify(marketing, null, 2));
                }
            } else {
                console.log('❌ Failed to save product to database');
            }

        } catch (error) {
            console.error('❌ Failed to generate product:', error.message);
        }
    }

    /**
     * Interactive product requirements gathering
     */
    async getProductRequirements() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const ask = (question) => new Promise(resolve => {
            rl.question(question, resolve);
        });

        console.log('Please provide product requirements:\n');

        const requirements = {
            type: await ask('Product type (loan, credit-card, mortgage, savings, investment): '),
            targetMarket: await ask('Target market (e.g., "young professionals", "retirees"): '),
            features: await ask('Key features (e.g., "low interest rates", "no fees"): '),
            budgetRange: await ask('Budget range (e.g., "$1,000 - $50,000"): '),
            specialRequirements: await ask('Special requirements (or press Enter to skip): '),
            competitiveFocus: await ask('Competitive focus (or press Enter for default): ')
        };

        rl.close();
        return requirements;
    }

    /**
     * List all products
     */
    async listProducts(args) {
        const filters = {};
        
        // Parse filters from command line
        args.forEach(arg => {
            if (arg.startsWith('--')) {
                const [key, value] = arg.slice(2).split('=');
                filters[key] = value?.replace(/['"]/g, '') || true;
            }
        });

        const products = this.database.getProducts(filters);
        
        console.log(`\n📋 Financial Products (${products.length} found):`);
        console.log(''.padEnd(80, '='));

        if (products.length === 0) {
            console.log('No products found matching the criteria.');
            return;
        }

        products.forEach((product, index) => {
            console.log(`\n${index + 1}. ${product.name} (${product.id})`);
            console.log(`   Type: ${product.type}`);
            console.log(`   Status: ${product.status}`);
            console.log(`   Created: ${new Date(product.createdAt).toLocaleDateString()}`);
            console.log(`   Description: ${product.description}`);
            
            if (product.terms?.interestRate) {
                console.log(`   Interest Rate: ${product.terms.interestRate}`);
            }
        });
    }

    /**
     * Delete a product
     */
    async deleteProduct(args) {
        const productId = args[0];
        
        if (!productId) {
            console.log('❌ Please provide a product ID to delete');
            console.log('Usage: delete <product_id> [--hard]');
            return;
        }

        const hardDelete = args.includes('--hard');
        const product = this.database.getProduct(productId);
        
        if (!product) {
            console.log(`❌ Product with ID '${productId}' not found`);
            return;
        }

        console.log(`\n🗑️ ${hardDelete ? 'Permanently deleting' : 'Deactivating'} product:`);
        this.displayProduct(product);

        const confirmed = await this.askYesNo(`Are you sure you want to ${hardDelete ? 'permanently delete' : 'deactivate'} this product?`);
        
        if (confirmed) {
            const success = this.database.deleteProduct(productId, hardDelete);
            if (success) {
                console.log(`✅ Product ${hardDelete ? 'deleted' : 'deactivated'} successfully`);
            }
        } else {
            console.log('❌ Operation cancelled');
        }
    }

    /**
     * Interactive product deletion
     */
    async interactiveDelete() {
        const products = this.database.getProducts({ active: true });
        
        if (products.length === 0) {
            console.log('❌ No active products found to delete');
            return;
        }

        console.log('\nActive Products:');
        products.forEach((product, index) => {
            console.log(`${index + 1}. ${product.name} (${product.id})`);
        });

        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const choice = await new Promise(resolve => {
            rl.question('\nEnter product number to delete (or 0 to cancel): ', resolve);
        });

        rl.close();

        const productIndex = parseInt(choice) - 1;
        if (productIndex >= 0 && productIndex < products.length) {
            await this.deleteProduct([products[productIndex].id]);
        } else if (choice !== '0') {
            console.log('❌ Invalid selection');
        }
    }

    /**
     * Analyze product portfolio
     */
    async analyzePortfolio(args) {
        console.log('🔍 Analyzing product portfolio using AI...\n');

        const products = this.database.getProducts({ active: true });
        
        if (products.length === 0) {
            console.log('❌ No active products found to analyze');
            return;
        }

        try {
            const analysis = await this.aiManager.analyzeProductPortfolio(products);
            
            console.log('📊 Portfolio Analysis Results:');
            console.log(''.padEnd(50, '='));
            console.log(JSON.stringify(analysis, null, 2));

            // Save analysis to file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `portfolio_analysis_${timestamp}.json`;
            require('fs').writeFileSync(filename, JSON.stringify(analysis, null, 2));
            console.log(`\n💾 Analysis saved to: ${filename}`);

        } catch (error) {
            console.error('❌ Failed to analyze portfolio:', error.message);
        }
    }

    /**
     * Get personalized product recommendations
     */
    async getRecommendations(args) {
        // Load customer data
        const XLSX = require('xlsx');
        let customers = [];
        
        try {
            const workbook = XLSX.readFile('nudge_customers.xlsx');
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            customers = XLSX.utils.sheet_to_json(worksheet);
        } catch (error) {
            console.log('❌ Could not load customer data from Excel file');
            return;
        }

        if (customers.length === 0) {
            console.log('❌ No customers found');
            return;
        }

        // Use first customer for demo or specified customer
        const customerIndex = args[0] ? parseInt(args[0]) - 1 : 0;
        const customer = customers[customerIndex] || customers[0];
        
        console.log(`🎯 Generating recommendations for: ${customer.first_name} ${customer.last_name}\n`);

        const products = this.database.getProducts({ active: true });
        
        try {
            const recommendations = await this.aiManager.generatePersonalizedRecommendations(customer, products);
            
            console.log('💡 Personalized Recommendations:');
            console.log(''.padEnd(50, '='));
            console.log(JSON.stringify(recommendations, null, 2));

        } catch (error) {
            console.error('❌ Failed to generate recommendations:', error.message);
        }
    }

    /**
     * Interactive customer recommendations
     */
    async interactiveRecommendations() {
        // This would be called from the interactive menu
        await this.getRecommendations(['1']); // Use first customer for demo
    }

    /**
     * Generate marketing copy for a product
     */
    async generateMarketing(args) {
        const productId = args[0];
        const channel = args[1] || 'email';
        
        if (!productId) {
            console.log('❌ Please provide a product ID');
            console.log('Usage: marketing <product_id> [channel]');
            return;
        }

        const product = this.database.getProduct(productId);
        if (!product) {
            console.log(`❌ Product with ID '${productId}' not found`);
            return;
        }

        console.log(`🎨 Generating ${channel} marketing copy for: ${product.name}\n`);

        try {
            const marketing = await this.aiManager.generateMarketingCopy(product, channel);
            
            console.log('📧 Generated Marketing Copy:');
            console.log(''.padEnd(50, '='));
            console.log(JSON.stringify(marketing, null, 2));

            // Save to file
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `marketing_${productId}_${channel}_${timestamp}.json`;
            require('fs').writeFileSync(filename, JSON.stringify(marketing, null, 2));
            console.log(`\n💾 Marketing copy saved to: ${filename}`);

        } catch (error) {
            console.error('❌ Failed to generate marketing copy:', error.message);
        }
    }

    /**
     * Interactive marketing copy generation
     */
    async interactiveMarketing() {
        const products = this.database.getProducts({ active: true });
        
        if (products.length === 0) {
            console.log('❌ No active products found');
            return;
        }

        console.log('\nActive Products:');
        products.forEach((product, index) => {
            console.log(`${index + 1}. ${product.name} (${product.id})`);
        });

        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const choice = await new Promise(resolve => {
            rl.question('\nEnter product number for marketing copy: ', resolve);
        });

        const channel = await new Promise(resolve => {
            rl.question('Enter channel (email, web, social): ', resolve);
        });

        rl.close();

        const productIndex = parseInt(choice) - 1;
        if (productIndex >= 0 && productIndex < products.length) {
            await this.generateMarketing([products[productIndex].id, channel || 'email']);
        } else {
            console.log('❌ Invalid selection');
        }
    }

    /**
     * Search products
     */
    async searchProducts(args) {
        const query = args.join(' ');
        
        if (!query) {
            console.log('❌ Please provide a search query');
            console.log('Usage: search <query>');
            return;
        }

        const results = this.database.searchProducts({ query });
        
        console.log(`\n🔍 Search Results for "${query}" (${results.length} found):`);
        console.log(''.padEnd(60, '='));

        if (results.length === 0) {
            console.log('No products found matching your search.');
            return;
        }

        results.forEach((product, index) => {
            console.log(`\n${index + 1}. ${product.name} (${product.id})`);
            console.log(`   Type: ${product.type}`);
            console.log(`   Description: ${product.description}`);
            console.log(`   Status: ${product.status}`);
        });
    }

    /**
     * Interactive search
     */
    async interactiveSearch() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const query = await new Promise(resolve => {
            rl.question('Enter search query: ', resolve);
        });

        rl.close();

        if (query) {
            await this.searchProducts([query]);
        }
    }

    /**
     * Show database statistics
     */
    async showStatistics(args) {
        const stats = this.database.getStatistics();
        
        console.log('\n📊 Product Database Statistics:');
        console.log(''.padEnd(40, '='));
        console.log(`Total Products: ${stats.total}`);
        console.log(`Active: ${stats.active}`);
        console.log(`Inactive: ${stats.inactive}`);
        console.log(`Draft: ${stats.draft}`);
        
        console.log('\nProducts by Type:');
        Object.entries(stats.byType).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });

        if (stats.newest) {
            console.log(`\nNewest Product: ${stats.newest.name} (${new Date(stats.newest.createdAt).toLocaleDateString()})`);
        }

        if (stats.oldest) {
            console.log(`Oldest Product: ${stats.oldest.name} (${new Date(stats.oldest.createdAt).toLocaleDateString()})`);
        }
    }

    /**
     * Export products
     */
    async exportProducts(args) {
        const format = args[0] || 'json';
        
        try {
            const filePath = this.database.exportProducts(format);
            console.log(`✅ Products exported successfully to: ${filePath}`);
        } catch (error) {
            console.error('❌ Export failed:', error.message);
        }
    }

    /**
     * Display product details
     */
    displayProduct(product) {
        console.log(`📦 Product: ${product.name}`);
        console.log(`🆔 ID: ${product.id}`);
        console.log(`📋 Type: ${product.type}`);
        console.log(`📝 Description: ${product.description}`);
        
        if (product.terms) {
            console.log('\n💰 Terms:');
            Object.entries(product.terms).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
        }

        if (product.features && product.features.length > 0) {
            console.log('\n✨ Features:');
            product.features.forEach(feature => {
                console.log(`  • ${feature}`);
            });
        }
    }

    /**
     * Ask yes/no question
     */
    async askYesNo(question) {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const answer = await new Promise(resolve => {
            rl.question(`${question} (y/N): `, resolve);
        });

        rl.close();
        return answer.toLowerCase().startsWith('y');
    }

    /**
     * Show help information
     */
    showHelp() {
        console.log('\n🏦 Customer Bank AI Product Manager - Help');
        console.log(''.padEnd(50, '='));
        console.log('\nAvailable Commands:');
        console.log('  generate [--type=<type>] [--target=<market>]  Generate new product');
        console.log('  list [--type=<type>] [--status=<status>]      List products');
        console.log('  delete <product_id> [--hard]                  Delete product');
        console.log('  analyze                                        Analyze portfolio');
        console.log('  recommend [customer_index]                     Get recommendations');
        console.log('  marketing <product_id> [channel]              Generate marketing');
        console.log('  search <query>                                 Search products');
        console.log('  stats                                          Show statistics');
        console.log('  export [format]                                Export products');
        console.log('  help                                           Show this help');
        console.log('\nExamples:');
        console.log('  node product-manager-cli.js generate --type=loan --target="millennials"');
        console.log('  node product-manager-cli.js list --status=active');
        console.log('  node product-manager-cli.js delete PL001');
        console.log('  node product-manager-cli.js search "credit card"');
    }
}

// Initialize sample products if database is empty
async function initializeSampleProducts(database) {
    const stats = database.getStatistics();
    
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
            database.addProduct(dbProduct);
        });
        
        console.log('✅ Sample products added to database');
    }
}

// Main execution
if (require.main === module) {
    const cli = new ProductManagerCLI();
    
    // Initialize sample products
    initializeSampleProducts(cli.database);
    
    // Run CLI
    cli.run().catch(error => {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    });
}

module.exports = ProductManagerCLI;
