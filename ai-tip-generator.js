const OpenAI = require('openai');
const fs = require('fs');

class AITipGenerator {
    constructor() {
        // Initialize OpenAI client
        const apiKey = this.loadOpenAIKey();
        this.openai = new OpenAI({
            apiKey: apiKey
        });
        
        this.tipCategories = {
            productivity: {
                name: 'Productivity',
                description: 'Tips to enhance work efficiency and output',
                keywords: ['efficiency', 'time management', 'workflow', 'automation', 'organization']
            },
            automation: {
                name: 'Automation', 
                description: 'Ways to automate repetitive tasks and processes',
                keywords: ['automation', 'scripting', 'workflows', 'tools', 'efficiency']
            },
            'data-analysis': {
                name: 'Data Analysis',
                description: 'AI-powered approaches to data insights and analytics',
                keywords: ['data', 'analytics', 'insights', 'visualization', 'reporting']
            },
            communication: {
                name: 'Communication',
                description: 'Enhanced communication with AI assistance',
                keywords: ['communication', 'writing', 'collaboration', 'meetings', 'messaging']
            },
            creativity: {
                name: 'Creativity',
                description: 'Using AI to boost creative thinking and innovation',
                keywords: ['creativity', 'brainstorming', 'innovation', 'ideation', 'problem-solving']
            },
            learning: {
                name: 'Learning',
                description: 'AI-assisted learning and skill development',
                keywords: ['learning', 'skills', 'training', 'development', 'knowledge']
            }
        };
    }

    loadOpenAIKey() {
        try {
            // Get API key from environment variable
            const key = process.env.OPENAI_API_KEY;
            if (!key) {
                throw new Error('OPENAI_API_KEY environment variable is not set');
            }
            return key;
        } catch (error) {
            console.error('Error loading OpenAI API key:', error);
            throw new Error('OpenAI API key is required for AI tip generation');
        }
    }

    async generateEmployeeTip(category = 'productivity', context = 'banking_industry') {
        try {
            console.log(`🤖 Generating AI tip for category: ${category}`);
            
            const categoryInfo = this.tipCategories[category] || this.tipCategories.productivity;
            
            const prompt = this.buildTipPrompt(categoryInfo, context);
            
            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are an AI productivity expert specializing in helping banking professionals "+
                        "leverage AI tools to improve their daily work. You provide practical, actionable tips that"+
                        " can be implemented immediately."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.8
            });

            const response = completion.choices[0]?.message?.content;
            if (!response) {
                throw new Error('No response generated from OpenAI');
            }

            const tip = this.parseTipResponse(response, categoryInfo);
            
            console.log(`✅ AI tip generated successfully: ${tip.title}`);
            return tip;

        } catch (error) {
            console.error('Error generating AI tip:', error);
            throw new Error(`Failed to generate AI tip: ${error.message}`);
        }
    }

    buildTipPrompt(categoryInfo, context) {
        const industryContext = context === 'banking_industry' 
            ? 'banking and financial services industry'
            : 'corporate environment';

        return `Generate a practical AI tip for employees in the ${industryContext} focused on ${categoryInfo.name.toLowerCase()}.

Requirements:
- Category: ${categoryInfo.name}
- Focus: ${categoryInfo.description}
- Keywords to incorporate: ${categoryInfo.keywords.join(', ')}
- Industry context: ${industryContext}
- Target audience: Banking professionals, analysts, customer service reps, managers
- Tone: Professional but engaging, encouraging adoption of AI mindset
- Length: 150-250 words
- Include: Specific tools or techniques when possible

Format your response as:
TITLE: [Catchy, action-oriented title]
CONTENT: [Main tip content with specific examples and actionable steps]

Make it practical and immediately implementable. Focus on building a "Digital AI Mindset" where employees see AI as a collaborator, not a replacement.`;
    }

    parseTipResponse(response, categoryInfo) {
        try {
            const lines = response.split('\n').filter(line => line.trim());
            
            let title = 'AI Tip of the Day';
            let content = response;

            // Try to extract title and content
            const titleMatch = response.match(/TITLE:\s*(.+)/i);
            const contentMatch = response.match(/CONTENT:\s*([\s\S]+)/i);

            if (titleMatch) {
                title = titleMatch[1].trim();
            }

            if (contentMatch) {
                content = contentMatch[1].trim();
            } else {
                // If no CONTENT: marker, use everything after TITLE:
                const titleIndex = response.indexOf('TITLE:');
                if (titleIndex !== -1) {
                    const afterTitle = response.substring(titleIndex);
                    const contentStart = afterTitle.indexOf('\n');
                    if (contentStart !== -1) {
                        content = afterTitle.substring(contentStart + 1).trim();
                    }
                }
            }

            // Clean up the content
            content = content
                .replace(/^CONTENT:\s*/i, '')
                .replace(/\n\n+/g, '</p><p>')
                .replace(/\n/g, '<br>')
                .trim();

            if (!content.startsWith('<p>')) {
                content = '<p>' + content + '</p>';
            }

            return {
                id: Date.now().toString(),
                title: title,
                content: content,
                category: categoryInfo.name.toLowerCase(),
                categoryDisplay: categoryInfo.name,
                keywords: categoryInfo.keywords,
                createdAt: new Date().toISOString(),
                aiGenerated: true
            };

        } catch (error) {
            console.error('Error parsing tip response:', error);
            
            // Fallback: return raw response as content
            return {
                id: Date.now().toString(),
                title: 'AI Tip of the Day',
                content: `<p>${response}</p>`,
                category: categoryInfo.name.toLowerCase(),
                categoryDisplay: categoryInfo.name,
                keywords: categoryInfo.keywords,
                createdAt: new Date().toISOString(),
                aiGenerated: true
            };
        }
    }

    async generatePersonalizedTip(employee, category = 'productivity') {
        try {
            console.log(`🎯 Generating personalized tip for ${employee.first_name} ${employee.last_name}`);
            
            const categoryInfo = this.tipCategories[category] || this.tipCategories.productivity;
            
            // Extract role/profile information from employee data
            const profileContext = this.extractEmployeeContext(employee);
            
            const prompt = `Generate a personalized AI tip for a banking employee with the following profile:

Employee Context:
- Name: ${employee.first_name} ${employee.last_name}
- Location: ${employee.city}, ${employee.province}
- Profile: ${profileContext}

Tip Requirements:
- Category: ${categoryInfo.name}
- Focus: ${categoryInfo.description}
- Make it relevant to their specific role and experience level
- Include actionable steps they can take this week
- Reference specific AI tools or techniques for banking professionals
- Encourage building a "Digital AI Mindset"

Format as:
TITLE: [Personalized title mentioning their name or role]
CONTENT: [Main tip content with specific examples relevant to their work]

Keep it professional, encouraging, and immediately actionable.`;

            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are an AI coach specializing in helping banking professionals adopt AI "+
                        "tools and develop a digital mindset. You create personalized, actionable advice."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 400,
                temperature: 0.8
            });

            const response = completion.choices[0]?.message?.content;
            if (!response) {
                throw new Error('No personalized tip generated');
            }

            const tip = this.parseTipResponse(response, categoryInfo);
            tip.personalized = true;
            tip.employeeName = `${employee.first_name} ${employee.last_name}`;
            
            console.log(`✅ Personalized tip generated for ${employee.first_name}`);
            return tip;

        } catch (error) {
            console.error('Error generating personalized tip:', error);
            // Fallback to general tip
            return await this.generateEmployeeTip(category);
        }
    }

    extractEmployeeContext(employee) {
        if (employee.profile && employee.profile.length > 50) {
            // Extract key information from profile
            const profile = employee.profile;
            
            // Look for job titles, roles, or industry keywords
            const roleKeywords = [
                'manager', 'analyst', 'specialist', 'coordinator', 'director',
                'representative', 'advisor', 'consultant', 'officer', 'associate',
                'senior', 'junior', 'lead', 'head', 'supervisor'
            ];
            
            const industryKeywords = [
                'banking', 'finance', 'credit', 'loan', 'investment', 'insurance',
                'accounting', 'audit', 'compliance', 'risk', 'operations'
            ];
            
            let context = '';
            
            // Extract sentences that might contain role information
            const sentences = profile.split('.').slice(0, 3); // First 3 sentences
            const relevantSentences = sentences.filter(sentence => {
                const lowerSentence = sentence.toLowerCase();
                return roleKeywords.some(keyword => lowerSentence.includes(keyword)) ||
                       industryKeywords.some(keyword => lowerSentence.includes(keyword));
            });
            
            if (relevantSentences.length > 0) {
                context = relevantSentences.join('. ').trim() + '.';
            } else {
                context = sentences[0] || 'Banking professional';
            }
            
            return context.substring(0, 200); // Limit length
        }
        
        return `Banking professional based in ${employee.city}`;
    }

    generateTipSubject(tip, employeeName = null) {
        const subjectTemplates = [
            `🤖 AI Tip of the Day: ${tip.title}`,
            `💡 Your Daily AI Boost: ${tip.title}`,
            `🚀 AI Productivity Tip: ${tip.title}`,
            `🎯 Digital Mindset: ${tip.title}`
        ];

        if (employeeName && tip.personalized) {
            const personalizedTemplates = [
                `${employeeName}, here's your AI tip: ${tip.title}`,
                `Personal AI tip for ${employeeName}: ${tip.title}`,
                `${employeeName}, boost your productivity: ${tip.title}`
            ];
            subjectTemplates.push(...personalizedTemplates);
        }

        // Return a random subject template
        return subjectTemplates[Math.floor(Math.random() * subjectTemplates.length)];
    }

    generateTipEmail(tip, employee) {
        const employeeName = `${employee.first_name} ${employee.last_name}`;
        
        return {
            subject: this.generateTipSubject(tip, employeeName),
            html: this.buildTipEmailHTML(tip, employee),
            text: this.buildTipEmailText(tip, employee)
        };
    }

    buildTipEmailHTML(tip, employee) {
        const employeeName = `${employee.first_name} ${employee.last_name}`;
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Tip of the Day</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .container {
            background: white;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #667eea;
        }
        .logo {
            font-size: 2rem;
            margin-bottom: 10px;
        }
        .title {
            color: #333;
            font-size: 1.8rem;
            font-weight: 600;
            margin-bottom: 20px;
        }
        .category {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
            display: inline-block;
            margin-bottom: 20px;
        }
        .content {
            font-size: 1.1rem;
            line-height: 1.7;
            margin-bottom: 30px;
        }
        .content p {
            margin-bottom: 15px;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            margin-top: 30px;
        }
        .footer h3 {
            color: #667eea;
            margin-bottom: 10px;
        }
        .signature {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            font-size: 0.9rem;
            color: #666;
        }
        .ai-badge {
            background: #28a745;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🤖 🏦 Customer Bank AI Assistant</div>
            <h1>AI Tip of the Day</h1>
        </div>
        
        <div class="greeting">
            <p>Hello ${employee.first_name},</p>
            <p>Here's your personalized AI tip to help you develop a stronger digital mindset and boost your productivity:</p>
        </div>
        
        <div class="category">${tip.categoryDisplay} <span class="ai-badge">AI Generated</span></div>
        
        <h2 class="title">${tip.title}</h2>
        
        <div class="content">
            ${tip.content}
        </div>
        
        <div class="footer">
            <h3>💡 Why This Matters</h3>
            <p>At 🏦 Customer Bank, we believe in empowering our employees with AI tools and a digital mindset. Small daily improvements in how we work with AI can lead to significant productivity gains and better customer service.</p>
            
            <p><strong>Try this tip today</strong> and let us know how it works for you!</p>
        </div>
        
        <div class="signature">
            <p>Best regards,<br>
            <strong>🏦 Customer Bank AI Development Team</strong></p>
            
            <p><em>This tip was generated by our AI assistant to help you build a stronger digital mindset. We're here to support your growth and success!</em></p>
        </div>
    </div>
</body>
</html>`;
    }

    buildTipEmailText(tip, employee) {
        const employeeName = `${employee.first_name} ${employee.last_name}`;
        
        // Convert HTML content to plain text
        const textContent = tip.content
            .replace(/<p>/g, '\n')
            .replace(/<\/p>/g, '\n')
            .replace(/<br\s*\/?>/g, '\n')
            .replace(/<[^>]*>/g, '')
            .replace(/\n\n+/g, '\n\n')
            .trim();
        
        return `
🤖 🏦 Customer Bank AI Assistant - AI Tip of the Day

Hello ${employee.first_name},

Here's your personalized AI tip to help you develop a stronger digital mindset and boost your productivity:

Category: ${tip.categoryDisplay} (AI Generated)

${tip.title}

${textContent}

💡 Why This Matters

At 🏦 Customer Bank, we believe in empowering our employees with AI tools and a digital mindset. Small daily improvements in how we work with AI can lead to significant productivity gains and better customer service.

Try this tip today and let us know how it works for you!

Best regards,
🏦 Customer Bank AI Development Team

This tip was generated by our AI assistant to help you build a stronger digital mindset. We're here to support your growth and success!
        `.trim();
    }
}

module.exports = AITipGenerator;
