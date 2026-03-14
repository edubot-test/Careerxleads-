
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config({ path: '/Users/priya/Documents/Lead Magnet/career-x-lead-discovery/.env.local' });

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function test() {
  try {
    console.log('Testing Claude 3.5 Sonnet...');
    const msg = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say hello in one word.' }],
    });
    console.log('Claude Success:', msg.content[0].text);
  } catch (err) {
    console.error('Claude Failed:', err.message);
  }
}

test();
