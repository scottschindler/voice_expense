/**
 * OpenAI API utility
 * 
 * Requires EXPO_PUBLIC_OPENAI_API_KEY in your .env file
 */

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

if (!OPENAI_API_KEY) {
  console.warn(
    '⚠️ OpenAI API key is missing!\n' +
    'Please set EXPO_PUBLIC_OPENAI_API_KEY in your environment variables.\n' +
    'Create a .env file in the root directory with this value.'
  );
}

export interface ExpenseData {
  amount: number | null;
  date: string | null;
  memo: string;
  category: string;
}

export async function categorizeText(text: string): Promise<ExpenseData | string> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: `Take this expense text and extract the following information in JSON format:
- amount: the dollar amount as a number (e.g., 42.00)
- date: ONLY if a date is explicitly mentioned in the text, extract it in format "MMM DD, YYYY" (e.g., "Apr 24, 2024"). If no date is mentioned, use null.
- memo: a brief description of the expense
- category: the expense category (e.g., "Meals", "Transportation", "Office Supplies", etc.)

Text: ${text}

Return only valid JSON in this format:
{
  "amount": 42.00,
  "date": "Apr 24, 2024" or null if no date mentioned,
  "memo": "Client lunch at Balthazar",
  "category": "Meals"
}`,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      const content = data.choices[0].message.content || '';
      
      // Try to parse JSON from the response
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || content.match(/(\{[\s\S]*\})/);
        const jsonString = jsonMatch ? jsonMatch[1] : content;
        return JSON.parse(jsonString);
      } catch (parseError) {
        // If parsing fails, return the raw content
        console.warn('Failed to parse OpenAI response as JSON:', parseError);
        return content;
      }
    }

    throw new Error('No response from OpenAI');
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

