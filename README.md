# CV Builder with AI Assistant

A modern, user-friendly web application for creating professional CVs (resumes) with the help of AI. Built with Node.js, Express, OpenAI API, and Puppeteer for PDF generation.

## Features

- **AI-Powered Content Generation**: Use OpenAI's GPT models to expand bullet points into professional CV content.
- **Live Preview**: See your CV update in real-time as you type.
- **Photo Upload**: Add a profile photo to your CV.
- **PDF Export**: Generate and download your CV as a PDF.
- **User Authentication**: Secure login and registration system.
- **Responsive Design**: Works beautifully on desktop, tablet, and mobile devices.
- **Professional Templates**: Clean, modern CV layout inspired by industry standards.

## Demo

[Live Demo](https://cv-builder.vercel.app) (deployed on Vercel)

## Technologies Used

- **Backend**: Node.js, Express.js
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **AI Integration**: OpenAI API (GPT-4o-mini)
- **PDF Generation**: Puppeteer
- **Authentication**: JWT (JSON Web Tokens)
- **Deployment**: Vercel (serverless)

## Prerequisites

Before running this application, make sure you have:

- Node.js (v16 or higher)
- npm or yarn
- An OpenAI API key ([get one here](https://platform.openai.com/api-keys))

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Abid22110/Cv-Builder.git
   cd Cv-Builder
   ```

2. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the `backend` folder:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   JWT_SECRET=your_jwt_secret_here
   PORT=4000
   ```

4. **Run the application**:
   ```bash
   npm start
   ```
   The app will be available at `http://localhost:4000`.

For development with auto-restart:
```bash
npm run dev
```

## Deployment

This app is configured for easy deployment on Vercel:

1. Fork or clone the repo to your GitHub.
2. Sign up at [vercel.com](https://vercel.com) and link your GitHub account.
3. Import the project and add environment variables in Vercel dashboard.
4. Deploy!

The `vercel.json` file handles the routing for the full-stack setup.

## Usage

1. **Register/Login**: Create an account to save your CVs.
2. **Fill in Your Details**: Enter personal info, experience, education, and skills.
3. **Use AI Assistant**: Provide short bullet points or prompts for AI to generate professional content.
4. **Preview**: See live updates in the preview pane.
5. **Generate PDF**: Click "Generate CV (PDF)" to download your resume.

## API Endpoints

- `POST /register`: User registration
- `POST /login`: User login
- `POST /generate`: Generate CV PDF
- `GET /cvs`: Get user's saved CVs

## Contributing

Contributions are welcome! Please:

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Abid Hussain** - [GitHub](https://github.com/Abid22110)

## Acknowledgments

- OpenAI for providing the AI capabilities
- Vercel for hosting
- Inspired by various CV builders and modern web design principles