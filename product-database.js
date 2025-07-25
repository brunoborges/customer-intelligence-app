/**
 * Product Database Manager for 🏦 Customer Bank
 * Manages financial products storage, retrieval, and lifecycle
 */

const fs = require('fs');
const path = require('path');

class ProductDatabase {
    constructor(dbPath = './products_database.json') {
        this.dbPath = dbPath;
        this.products = new Map();
        this.loadDatabase();
    }

    /**
     * Load products from database file
     */
    loadDatabase() {
        try {
            if (fs.existsSync(this.dbPath)) {
                const data = fs.readFileSync(this.dbPath, 'utf8');
                const products = JSON.parse(data);
                
                // Convert array to Map for better performance
                products.forEach(product => {
                    this.products.set(product.id, product);
                });
                
                console.log(`✅ Loaded ${this.products.size} products from database`);
            } else {
                console.log('📁 Creating new product database');
                this.saveDatabase();
            }
        } catch (error) {
            console.error('❌ Error loading database:', error.message);
            throw new Error('Failed to load product database');
        }
    }

    /**
     * Save products to database file
     */
    saveDatabase() {
        try {
            const productsArray = Array.from(this.products.values());
            fs.writeFileSync(this.dbPath, JSON.stringify(productsArray, null, 2));
            console.log(`💾 Saved ${productsArray.length} products to database`);
        } catch (error) {
            console.error('❌ Error saving database:', error.message);
            throw new Error('Failed to save product database');
        }
    }

    /**
     * Add a new product to the database
     * @param {Object} product - Product to add
     * @returns {boolean} - Success status
     */
    addProduct(product) {
        try {
            // Validate required fields
            if (!product.id || !product.name || !product.type) {
                throw new Error('Product must have id, name, and type');
            }

            // Check if product already exists
            if (this.products.has(product.id)) {
                throw new Error(`Product with ID ${product.id} already exists`);
            }

            // Add timestamps
            product.createdAt = new Date().toISOString();
            product.updatedAt = new Date().toISOString();
            product.status = product.status || 'active';

            // Add to database
            this.products.set(product.id, product);
            this.saveDatabase();

            console.log(`✅ Added product: ${product.name} (${product.id})`);
            return true;

        } catch (error) {
            console.error('❌ Error adding product:', error.message);
            return false;
        }
    }

    /**
     * Get a product by ID
     * @param {string} id - Product ID
     * @returns {Object|null} - Product object or null if not found
     */
    getProduct(id) {
        return this.products.get(id) || null;
    }

    /**
     * Get all products or filter by criteria
     * @param {Object} filters - Filter criteria
     * @returns {Array} - Array of products
     */
    getProducts(filters = {}) {
        let products = Array.from(this.products.values());

        // Apply filters
        if (filters.type) {
            products = products.filter(p => p.type === filters.type);
        }

        if (filters.status) {
            products = products.filter(p => p.status === filters.status);
        }

        if (filters.active !== undefined) {
            products = products.filter(p => p.status === 'active');
        }

        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            products = products.filter(p => 
                p.name.toLowerCase().includes(searchTerm) ||
                p.description.toLowerCase().includes(searchTerm)
            );
        }

        return products;
    }

    /**
     * Update an existing product
     * @param {string} id - Product ID
     * @param {Object} updates - Updates to apply
     * @returns {boolean} - Success status
     */
    updateProduct(id, updates) {
        try {
            const product = this.products.get(id);
            if (!product) {
                throw new Error(`Product with ID ${id} not found`);
            }

            // Apply updates
            Object.assign(product, updates);
            product.updatedAt = new Date().toISOString();

            // Save to database
            this.saveDatabase();

            console.log(`✅ Updated product: ${product.name} (${id})`);
            return true;

        } catch (error) {
            console.error('❌ Error updating product:', error.message);
            return false;
        }
    }

    /**
     * Delete a product (soft delete by default)
     * @param {string} id - Product ID
     * @param {boolean} hardDelete - Whether to permanently delete
     * @returns {boolean} - Success status
     */
    deleteProduct(id, hardDelete = false) {
        try {
            const product = this.products.get(id);
            if (!product) {
                throw new Error(`Product with ID ${id} not found`);
            }

            if (hardDelete) {
                // Permanently remove from database
                this.products.delete(id);
                console.log(`🗑️ Permanently deleted product: ${product.name} (${id})`);
            } else {
                // Soft delete - mark as inactive
                product.status = 'inactive';
                product.deletedAt = new Date().toISOString();
                product.updatedAt = new Date().toISOString();
                console.log(`🚫 Deactivated product: ${product.name} (${id})`);
            }

            this.saveDatabase();
            return true;

        } catch (error) {
            console.error('❌ Error deleting product:', error.message);
            return false;
        }
    }

    /**
     * Get product statistics
     * @returns {Object} - Database statistics
     */
    getStatistics() {
        const products = Array.from(this.products.values());
        
        const stats = {
            total: products.length,
            active: products.filter(p => p.status === 'active').length,
            inactive: products.filter(p => p.status === 'inactive').length,
            draft: products.filter(p => p.status === 'draft').length,
            byType: {},
            newest: null,
            oldest: null
        };

        // Count by type
        products.forEach(product => {
            stats.byType[product.type] = (stats.byType[product.type] || 0) + 1;
        });

        // Find newest and oldest
        if (products.length > 0) {
            const sorted = products.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            stats.oldest = sorted[0];
            stats.newest = sorted[sorted.length - 1];
        }

        return stats;
    }

    /**
     * Search products with advanced criteria
     * @param {Object} criteria - Search criteria
     * @returns {Array} - Matching products
     */
    searchProducts(criteria) {
        let products = Array.from(this.products.values());

        // Text search
        if (criteria.query) {
            const query = criteria.query.toLowerCase();
            products = products.filter(product => {
                return (
                    product.name.toLowerCase().includes(query) ||
                    product.description.toLowerCase().includes(query) ||
                    product.detailedDescription?.toLowerCase().includes(query) ||
                    product.features?.some(f => f.toLowerCase().includes(query)) ||
                    product.benefits?.some(b => b.toLowerCase().includes(query))
                );
            });
        }

        // Interest rate range
        if (criteria.minRate || criteria.maxRate) {
            products = products.filter(product => {
                const rate = parseFloat(product.terms?.interestRate?.replace(/[^\d.]/g, ''));
                if (isNaN(rate)) return true; // Include products without rates
                
                if (criteria.minRate && rate < criteria.minRate) return false;
                if (criteria.maxRate && rate > criteria.maxRate) return false;
                return true;
            });
        }

        // Amount range
        if (criteria.minAmount || criteria.maxAmount) {
            products = products.filter(product => {
                const minAmount = parseFloat(product.terms?.minimumAmount?.replace(/[^\d]/g, ''));
                const maxAmount = parseFloat(product.terms?.maximumAmount?.replace(/[^\d]/g, ''));
                
                if (criteria.minAmount && maxAmount < criteria.minAmount) return false;
                if (criteria.maxAmount && minAmount > criteria.maxAmount) return false;
                return true;
            });
        }

        // Target audience
        if (criteria.creditScore) {
            products = products.filter(product => {
                const scoreRange = product.targetAudience?.creditScoreRange;
                if (!scoreRange) return true;
                
                const [minScore, maxScore] = scoreRange.split('-').map(s => parseInt(s));
                return criteria.creditScore >= minScore && criteria.creditScore <= maxScore;
            });
        }

        return products;
    }

    /**
     * Export products to different formats
     * @param {string} format - Export format (json, csv, xlsx)
     * @param {Array} productIds - Specific products to export (optional)
     * @returns {string} - Export file path
     */
    exportProducts(format = 'json', productIds = null) {
        try {
            let products = Array.from(this.products.values());
            
            if (productIds) {
                products = products.filter(p => productIds.includes(p.id));
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `products_export_${timestamp}.${format}`;
            const filePath = path.join(__dirname, fileName);

            switch (format.toLowerCase()) {
                case 'json':
                    fs.writeFileSync(filePath, JSON.stringify(products, null, 2));
                    break;
                
                case 'csv':
                    const csvContent = this.convertToCSV(products);
                    fs.writeFileSync(filePath, csvContent);
                    break;
                
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            console.log(`📄 Exported ${products.length} products to ${fileName}`);
            return filePath;

        } catch (error) {
            console.error('❌ Error exporting products:', error.message);
            throw error;
        }
    }

    /**
     * Convert products to CSV format
     * @param {Array} products - Products to convert
     * @returns {string} - CSV content
     */
    convertToCSV(products) {
        if (products.length === 0) return '';

        const headers = ['id', 'name', 'type', 'description', 'interestRate', 'minimumAmount', 'maximumAmount', 'status', 'createdAt'];
        const csvRows = [headers.join(',')];

        products.forEach(product => {
            const row = [
                product.id,
                `"${product.name}"`,
                product.type,
                `"${product.description}"`,
                product.terms?.interestRate || '',
                product.terms?.minimumAmount || '',
                product.terms?.maximumAmount || '',
                product.status,
                product.createdAt
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }

    /**
     * Create a backup of the database
     * @returns {string} - Backup file path
     */
    createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${this.dbPath}.backup.${timestamp}`;
            
            fs.copyFileSync(this.dbPath, backupPath);
            console.log(`💾 Created backup: ${backupPath}`);
            
            return backupPath;
        } catch (error) {
            console.error('❌ Error creating backup:', error.message);
            throw error;
        }
    }
}

module.exports = ProductDatabase;
