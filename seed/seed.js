import { connectDb, disconnectDb } from '../config/db.js';
import { env } from '../config/env.js';
import { User, createUser } from '../models/user.model.js';
import { Article, CATEGORIES } from '../models/article.model.js';
import { Comment } from '../models/comment.model.js';
import { ViewEvent } from '../models/viewEvent.model.js';
import crypto from 'node:crypto';

function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomString(length) {
    return Math.random().toString(36).substring(2, 2 + length);
}

async function seed() {
    await connectDb(env.mongoUri);
    console.log('Connected to DB');

    // Securely source the seed password from the environment, or generate a random one
    const seedPassword = process.env.SEED_PASSWORD || crypto.randomBytes(6).toString('hex');

    // Clean existing data
    await User.deleteMany({});
    await Article.deleteMany({});
    await Comment.deleteMany({});
    await ViewEvent.deleteMany({});
    console.log('Cleared existing data');

    // Create Editor
    const editor = await createUser({
        username: 'editor',
        password: seedPassword,
        role: 'editor',
        displayName: 'The Editor'
    });

    // Create Reporters
    const reporters = [];
    for (let i = 1; i <= 5; i++) {
        reporters.push(await createUser({
            username: `reporter${i}`,
            password: seedPassword,
            role: 'reporter',
            displayName: `Reporter ${i}`
        }));
    }
    console.log('Created users');

    const now = Date.now();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    
    // Create 500 Articles
    let articles = [];
    const states = ['In Preparation', 'Pending Editor Approval', 'Published', 'Returned for Corrections'];
    
    for (let i = 1; i <= 500; i++) {
        const state = randomChoice(states);
        const category = randomChoice(CATEGORIES);
        const author = randomChoice(reporters);
        const hasBeenUpdated = Math.random() > 0.5; // for published articles

        let articleData = {
            title: `Article Title ${i}`,
            abstract: `This is an abstract for article ${i}.`,
            body: `This is the body of article ${i}. It is slightly longer.`,
            category,
            author: author._id,
            state
        };

        if (state === 'Published') {
            const firstPublishedAt = new Date(now - randomInt(1, 10) * MS_PER_DAY);
            articleData.firstPublishedAt = firstPublishedAt;
            articleData.slug = `article-title-${i}-${generateRandomString(4)}`;
            
            articleData.published = {
                title: articleData.title,
                abstract: articleData.abstract,
                body: articleData.body,
                category: articleData.category,
                publishedAt: firstPublishedAt,
                version: 1
            };
            
            articleData.history = [
                { kind: 'publish', at: firstPublishedAt, by: editor._id }
            ];

            if (hasBeenUpdated) {
                const updatedAt = new Date(firstPublishedAt.getTime() + randomInt(1, 12) * 60 * 60 * 1000);
                articleData.published.version = 2;
                articleData.published.publishedAt = updatedAt;
                articleData.published.body = `Updated body for article ${i}`;
                articleData.history.push({ kind: 'update', at: updatedAt, by: editor._id });
            }
        } else if (state === 'Returned for Corrections') {
            articleData.editorNote = 'Please fix the typo in the third paragraph.';
        } else if (state === 'Pending Editor Approval') {
            articleData.submittedAt = new Date(now - randomInt(1, 24) * 60 * 60 * 1000);
        }

        const doc = new Article(articleData);
        articles.push(doc);
    }
    
    await Article.insertMany(articles);
    console.log('Created articles');

    // Create Comments & ViewEvents for Published articles
    const publishedArticles = articles.filter(a => a.state === 'Published');
    let comments = [];
    let viewEvents = [];
    
    for (const article of publishedArticles) {
        // Comments
        const numComments = randomInt(0, 5);
        for (let c = 0; c < numComments; c++) {
            comments.push(new Comment({
                article: article._id,
                authorName: `Guest ${randomInt(1, 100)}`,
                body: `This is a comment number ${c} on article ${article._id}`,
                deviceId: generateRandomString(12),
                createdAt: new Date(article.firstPublishedAt.getTime() + randomInt(10000, MS_PER_DAY))
            }));
        }

        // ViewEvents (dense enough to show graph)
        const numViews = randomInt(50, 200);
        const publishTime = article.firstPublishedAt.getTime();
        for (let v = 0; v < numViews; v++) {
            // Distribute views between publishTime and now
            const viewTime = publishTime + Math.random() * (now - publishTime);
            viewEvents.push(new ViewEvent({
                article: article._id,
                at: new Date(viewTime)
            }));
        }
        
        // update view count on article
        await Article.updateOne({ _id: article._id }, { $set: { viewCount: numViews } });
    }

    // Insert comments in batches to prevent payload too large
    await Comment.insertMany(comments);
    
    // Insert view events in chunks
    const chunkSize = 5000;
    for (let i = 0; i < viewEvents.length; i += chunkSize) {
        await ViewEvent.insertMany(viewEvents.slice(i, i + chunkSize));
    }
    
    console.log(`Created ${comments.length} comments and ${viewEvents.length} view events.`);
    console.log('---');
    console.log('Seed completed successfully!');
    console.log('Logins (Save these!):');
    console.log(`  Editor:   username: editor      password: ${seedPassword}`);
    console.log(`  Reporter: username: reporter1   password: ${seedPassword}`);
    
    await disconnectDb();
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
