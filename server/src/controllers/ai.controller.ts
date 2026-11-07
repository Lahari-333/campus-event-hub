import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response';

/**
 * POST /api/events/ai-suggest
 * Generates structured, high-engagement event metadata, tags, and prerequisites
 * based on the title and category. Fully self-contained with zero external API key requirements.
 */
export async function generateAiSuggestions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { title, category } = req.body;

    if (!title || typeof title !== 'string') {
      sendError(res, 400, 'Event title is required for AI enhancement');
      return;
    }

    const eventTitle = title.trim();
    const eventCategory = category || 'Technical';

    // Domain templates tailored to campus events
    const categoryTemplates: Record<
      string,
      { descPrefix: string; tags: string[]; prereqs: string[]; tips: string }
    > = {
      Hackathon: {
        descPrefix: `Join us for ${eventTitle}, an intensive campus coding marathon designed to turn groundbreaking concepts into production-ready software solutions. Teams of up to 4 will collaborate over 24-36 hours, mentored by industry veterans and alumni leaders. Build innovative full-stack prototypes, explore cutting-edge APIs, and compete for cash prizes, developer swag, and recruitment interviews.`,
        tags: ['Hackathon', 'Coding', 'OpenSource', 'Web3', 'AI/ML', 'Teamwork', 'Prototyping'],
        prereqs: [
          'Bring your own laptop with development environment configured',
          'Basic familiarity with Git, GitHub, and any modern web/mobile stack',
          'College Student ID card for physical entrance check-in',
        ],
        tips: 'Teams can register in advance or form organically during opening team-building mixers.',
      },
      Technical: {
        descPrefix: `Deep-dive into the state-of-the-art with ${eventTitle}. This technical summit brings hands-on system architecture, algorithmic problem-solving, and live code walkthroughs right to our campus. Whether you are aiming to master cloud scalability or crack top-tier engineering interviews, this session provides high-signal actionable insights.`,
        tags: ['ComputerScience', 'Engineering', 'Algorithms', 'SystemDesign', 'DevOps', 'Career'],
        prereqs: [
          'Fundamental knowledge of Data Structures and Object-Oriented Programming',
          'Curiosity to explore distributed systems and real-world infrastructure',
        ],
        tips: 'Interactive Q&A and networking lounge open immediately following the keynotes.',
      },
      Workshop: {
        descPrefix: `Accelerate your practical skills in ${eventTitle}. This interactive, step-by-step masterclass is tailored for immediate real-world application. Learn best practices, avoid common anti-patterns, and build a portfolio-ready project from scratch with step-by-step guidance.`,
        tags: ['HandsOn', 'Workshop', 'Masterclass', 'Portfolio', 'SkillBuilding', 'Practical'],
        prereqs: [
          'Laptop with modern browser and code editor (VS Code recommended)',
          'No prior advanced prerequisites required — beginner friendly',
        ],
        tips: 'Digital Certificate of Participation issued to all attendees upon verified check-in.',
      },
      Cultural: {
        descPrefix: `Experience the vibrant energy and artistic talent of our student community at ${eventTitle}. Featuring live stage performances, creative exhibitions, musical sets, and culinary showcases celebrating diversity, passion, and campus unity.`,
        tags: ['Cultural', 'Music', 'Arts', 'CampusLife', 'Performances', 'Celebration'],
        prereqs: ['Valid student registration pass', 'Enthusiasm and campus spirit'],
        tips: 'Entry closes 15 minutes before the opening act. Arrive early for prime seating.',
      },
    };

    const template =
      categoryTemplates[eventCategory] || categoryTemplates['Technical'];

    const suggestedDescription = `${template.descPrefix}\n\nKey Highlights:\n• Live hands-on sessions with real-time feedback\n• Direct interaction with experienced guest speakers and mentors\n• Official digital accreditation and verifiable entry pass\n• Refreshments and networking opportunities provided.`;

    sendSuccess(res, 200, 'AI enhancements generated successfully', {
      enhancedDescription: suggestedDescription,
      suggestedTags: template.tags,
      prerequisites: template.prereqs,
      organizerTips: template.tips,
    });
  } catch (err) {
    next(err);
  }
}
