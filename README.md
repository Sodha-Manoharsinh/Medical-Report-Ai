# Medical Report AI

> A full-stack medical document processing and analysis application powered by **IBM Bob AI**, designed to extract structured medical information, generate summaries, analyze patient records, and provide document-grounded question answering.

---

## Overview

**Medical Report AI** is a full-stack application that transforms medical documents into structured, readable, and searchable patient information.

The application accepts medical documents such as PDFs, scanned images, Word documents, and text files. It extracts the available text, sends only the extracted information to the **IBM Bob API** for structured processing, stores the resulting medical facts in PostgreSQL, and provides multiple ways to review and analyze the information.

### Core Principle

> **Data Integrity First:** The AI only works with information explicitly present in the uploaded documents. It must not invent, assume, or infer medical facts that are not supported by the source documents.

---

## Architecture

```text
                         ┌─────────────────────┐
                         │   Medical Document  │
                         │ PDF / Image / DOCX  │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Text Extraction   │
                         │                     │
                         │ pdfplumber          │
                         │ pytesseract         │
                         │ python-docx         │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ AI Extraction       │
                         │ Service             │
                         │                     │
                         │ IBM Bob API         │
                         │ Structured Facts    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │     PostgreSQL      │
                         │                     │
                         │ Documents           │
                         │ Patient Profiles    │
                         │ Extracted Facts     │
                         │ Summaries           │
                         │ Q&A History         │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
             ┌────────────┐  ┌────────────┐  ┌────────────┐
             │  Summary   │  │  Analysis  │  │    Q&A     │
             │  Service   │  │  Service   │  │  Service   │
             └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
                   │               │               │
                   └───────────────┼───────────────┘
                                   ▼
                         ┌─────────────────────┐
                         │   PDF Report        │
                         │   Generator         │
                         │   ReportLab         │
                         └─────────────────────┘
```

---

## Key Features

### Authentication

- Email and phone-based login
- Six-digit OTP verification
- Session-based authentication
- 24-hour session token expiry
- Development mode with OTP printed to the console
- Automatic OTP filling during development

### Medical Document Processing

Supports the following document formats:

- PDF
- PNG
- JPG / JPEG
- TIFF
- BMP
- GIF
- TXT
- DOC
- DOCX

Additional functionality includes:

- Drag-and-drop document upload
- Upload progress feedback
- PDF text extraction using `pdfplumber`
- Image OCR using `pytesseract`
- Microsoft Word extraction using `python-docx`
- AI-powered structured medical fact extraction
- Separate storage of raw extracted text and structured facts
- Preservation of original extracted information

### Medical Summary

The medical summary interface provides:

1. **Overview Summary**
   - AI-generated clinical summary
   - Human-readable medical information
   - PDF download

2. **Lab Results**
   - Test names
   - Test values
   - Units
   - Reference ranges

3. **Vital Signs**
   - Blood pressure
   - Temperature
   - Heart rate
   - Other available vital measurements

4. **Diagnoses & Allergies**
   - Recorded diagnoses
   - Documented allergies
   - Other relevant medical information

5. **Analysis**
   - Medical timeline
   - Medication summary
   - Notable changes
   - Missing or unavailable information

### Q&A Assistant

The application provides a dedicated question-answering interface that allows users to ask questions about uploaded patient documents.

Features include:

- Conversational interface
- Patient-data-grounded answers
- No unsupported medical assumptions
- Persistent conversation history
- Clear conversation history functionality

### PDF Report Generation

A complete clinical report can be generated as an A4 PDF containing:

- Patient information
- Laboratory results
- Vital signs
- Medications
- Diagnoses
- Allergies
- Medical timeline
- Other available structured information

PDF generation is implemented using **ReportLab**.

---

## Technology Stack

| Layer           | Technology                        |
| --------------- | --------------------------------- |
| Backend         | Python 3.11+ / Flask              |
| Database        | PostgreSQL 14+                    |
| AI              | IBM Bob API — OpenAI-compatible   |
| Frontend        | HTML5 / CSS3 / Vanilla JavaScript |
| PDF Processing  | pdfplumber                        |
| OCR             | pytesseract / Tesseract           |
| Word Processing | python-docx                       |
| PDF Generation  | ReportLab                         |
| Authentication  | OTP + Session Tokens              |
| Configuration   | python-dotenv                     |

---

## Application Workflow

The application follows this processing pipeline:

```text
1. User uploads medical document
                ↓
2. File type is validated
                ↓
3. Document text is extracted
                ↓
4. OCR is applied when required
                ↓
5. Extracted content is sent to IBM Bob
                ↓
6. Bob extracts structured medical facts
                ↓
7. Structured facts are stored in PostgreSQL
                ↓
8. Summary / Analysis / Q&A services use stored facts
                ↓
9. User views medical information
                ↓
10. Optional clinical PDF report is generated
```

The original extracted information is kept separate from AI-generated outputs to maintain data traceability.

---

## Prerequisites

Before running the application, install the following:

- **Python 3.11 or later**
- **PostgreSQL 14 or later**
- **IBM Bob** running locally or an accessible Bob-compatible API endpoint
- **Tesseract OCR** — optional, required for OCR-based image documents

---

## Installing Tesseract OCR

Tesseract is required when the application needs to extract text from scanned or image-based documents.

### Windows

Download and install Tesseract from:

https://github.com/UB-Mannheim/tesseract/wiki

After installation, make sure the Tesseract executable is available in your system `PATH`.

### macOS

```bash
brew install tesseract
```

### Linux

```bash
sudo apt update
sudo apt install tesseract-ocr
```

---

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd medical-report-ai
```

If the repository has already been downloaded:

```bash
cd medical-report-ai
```

---

### 2. Create a Virtual Environment

#### Windows

```bash
python -m venv venv
venv\Scripts\activate
```

#### macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
```

---

### 3. Install Python Dependencies

```bash
pip install -r requirements.txt
```

---

## Database Setup

Make sure PostgreSQL is installed and running.

Create a PostgreSQL database for the application:

```sql
CREATE DATABASE medical_report_ai;
```

The database connection can then be configured using the `DATABASE_URL` environment variable.

Example:

```text
postgresql://postgres:password@localhost/medical_report_ai
```

---

## Environment Configuration

Create a `.env` file from the provided example:

```bash
cp .env.example .env
```

On Windows, you can manually copy `.env.example` to `.env` if the `cp` command is unavailable.

Update the `.env` file with your local configuration.

### Environment Variables

| Variable           | Default                                                      | Description                                  |
| ------------------ | ------------------------------------------------------------ | -------------------------------------------- |
| `DATABASE_URL`     | `postgresql://postgres:password@localhost/medical_report_ai` | PostgreSQL connection string                 |
| `BOB_API_BASE_URL` | `http://localhost:11434/v1`                                  | IBM Bob API base URL                         |
| `BOB_API_KEY`      | Empty                                                        | API key if required                          |
| `BOB_MODEL`        | `granite3.3:8b`                                              | AI model used by the application             |
| `OTP_DEV_MODE`     | `true`                                                       | Prints OTP to the console during development |

### Example `.env`

```env
DATABASE_URL=postgresql://postgres:password@localhost/medical_report_ai

BOB_API_BASE_URL=http://localhost:11434/v1
BOB_API_KEY=
BOB_MODEL=granite3.3:8b

OTP_DEV_MODE=true
```

> **Important:** Never commit your `.env` file or expose API keys, database credentials, or other secrets in source control.

---

## Project Setup

Run the setup script:

```bash
python setup.py
```

The setup process is responsible for:

- Initializing the database
- Creating required database tables
- Checking the configured Bob API
- Preparing the application environment

---

## Running the Application

Start the Flask backend:

```bash
cd backend
python app.py
```

The application should then be available at:

```text
http://localhost:5000
```

Open the address in a web browser to access the application.

---

## API Reference

All protected endpoints require a valid authentication session.

### Authentication

| Method | Endpoint               | Description                         | Authentication |
| ------ | ---------------------- | ----------------------------------- | -------------- |
| `POST` | `/api/auth/login`      | Start OTP login                     | No             |
| `POST` | `/api/auth/verify-otp` | Verify OTP and obtain session token | No             |
| `POST` | `/api/auth/logout`     | Invalidate current session          | Yes            |

### Documents

| Method   | Endpoint                | Description                           | Authentication |
| -------- | ----------------------- | ------------------------------------- | -------------- |
| `POST`   | `/api/documents/upload` | Upload and process a medical document | Yes            |
| `GET`    | `/api/documents/`       | Retrieve uploaded documents           | Yes            |
| `DELETE` | `/api/documents/`       | Delete a document                     | Yes            |

### Summary & Analysis

| Method | Endpoint                    | Description                        | Authentication |
| ------ | --------------------------- | ---------------------------------- | -------------- |
| `GET`  | `/api/summary/patient-data` | Retrieve structured patient facts  | Yes            |
| `POST` | `/api/summary/generate`     | Generate an AI medical summary     | Yes            |
| `GET`  | `/api/summary/latest`       | Retrieve the latest stored summary | Yes            |
| `POST` | `/api/summary/analyze`      | Run medical record analysis        | Yes            |

### Q&A

| Method   | Endpoint          | Description                       | Authentication |
| -------- | ----------------- | --------------------------------- | -------------- |
| `POST`   | `/api/qa/ask`     | Ask a question about patient data | Yes            |
| `GET`    | `/api/qa/history` | Retrieve Q&A conversation history | Yes            |
| `DELETE` | `/api/qa/history` | Clear Q&A conversation history    | Yes            |

### PDF

| Method | Endpoint            | Description                                 | Authentication |
| ------ | ------------------- | ------------------------------------------- | -------------- |
| `POST` | `/api/pdf/generate` | Generate and download a clinical PDF report | Yes            |

---

## Project Structure

```text
medical-report-ai/
│
├── backend/
│   ├── app.py                       # Flask application entry point
│   ├── config.py                    # Application configuration
│   ├── database.py                  # Database connection and initialization
│   ├── schema.sql                   # PostgreSQL database schema
│   │
│   ├── routes/
│   │   ├── auth.py                  # Authentication and OTP
│   │   ├── documents.py             # Document upload and management
│   │   ├── summary.py               # Summary and analysis
│   │   ├── qa.py                    # Q&A assistant
│   │   ├── pdf.py                   # PDF report endpoint
│   │   └── middleware.py            # Authentication middleware
│   │
│   └── services/
│       ├── bob_client.py            # IBM Bob API integration
│       ├── extractor.py             # PDF, OCR and DOCX extraction
│       └── pdf_generator.py         # ReportLab PDF generation
│
├── frontend/
│   ├── templates/
│   │   └── index.html               # Main application interface
│   │
│   └── static/
│       ├── css/
│       │   └── styles.css           # Application styles
│       └── js/
│           └── app.js                # Frontend JavaScript
│
├── uploads/                          # Uploaded files (gitignored)
│
├── requirements.txt                  # Python dependencies
├── setup.py                          # Application setup script
├── .env.example                      # Environment configuration template
└── README.md                         # Project documentation
```

---

## Data Integrity & AI Safety

Medical information is sensitive and requires careful handling.

The application follows a **document-grounded processing model**.

### The AI may:

- Extract information explicitly stated in documents
- Organize medical information into structured fields
- Summarize documented information
- Identify documented changes over time
- Answer questions using available patient data
- Report when information is unavailable

### The AI must not:

- Invent medical facts
- Guess missing values
- Assume a diagnosis that is not documented
- Create undocumented medications
- Modify original extracted medical data
- Treat missing information as negative information
- Present unsupported conclusions as documented facts

For example, if a patient's blood pressure is not present in the uploaded documents, the system should report that the blood pressure information is unavailable rather than attempting to estimate it.

---

## Security

The application includes several security measures:

- OTP codes expire after 10 minutes by default
- Session tokens are generated using secure random values
- Session tokens are not embedded directly into frontend HTML
- File uploads are restricted using an extension whitelist
- SQL queries use parameterized statements
- Authentication middleware protects private API endpoints
- Uploaded files are stored separately from application source code

### Production Recommendations

Before deploying to production:

1. Set:

```env
OTP_DEV_MODE=false
```

2. Configure a real email/SMS OTP provider.

3. Use HTTPS.

4. Store secrets using secure environment variables or a secret-management system.

5. Restrict database access.

6. Configure appropriate file-size limits.

7. Validate and sanitize all uploaded documents.

8. Do not commit `.env` or credentials to Git.

9. Review access controls before exposing patient information publicly.

---

## Development Mode

During development, OTP verification can be simplified using:

```env
OTP_DEV_MODE=true
```

In this mode, the generated OTP is printed to the backend console and can be automatically populated by the frontend.

For production environments, disable development OTP mode:

```env
OTP_DEV_MODE=false
```

---

## Supported Document Processing

| Document Type | Processing Method        |
| ------------- | ------------------------ |
| PDF           | `pdfplumber`             |
| PNG           | Tesseract OCR            |
| JPG / JPEG    | Tesseract OCR            |
| TIFF          | Tesseract OCR            |
| BMP           | Tesseract OCR            |
| GIF           | Tesseract OCR            |
| TXT           | Native text reading      |
| DOC           | Word document processing |
| DOCX          | `python-docx`            |

For scanned PDFs, OCR may be required depending on whether the PDF contains selectable text.

---

## Database

PostgreSQL is used as the primary persistent data store.

The database stores information such as:

- User accounts
- Uploaded documents
- Extracted medical facts
- Patient profiles
- AI-generated summaries
- Analysis results
- Q&A conversation history
- OTP/session-related information

The application maintains separation between **source-derived data** and **AI-generated outputs** wherever applicable.

---

## IBM Bob Integration

The AI functionality is provided through the **IBM Bob API**, using an OpenAI-compatible API interface.

The integration is centralized in:

```text
backend/services/bob_client.py
```

The Bob service is responsible for AI operations such as:

- Structured medical fact extraction
- Medical summary generation
- Patient record analysis
- Document-grounded question answering

The model and API endpoint are configurable through environment variables:

```env
BOB_API_BASE_URL=http://localhost:11434/v1
BOB_API_KEY=
BOB_MODEL=granite3.3:8b
```

This allows the AI provider configuration to be changed without modifying application source code.

---

## Error Handling

The application should gracefully handle common failures, including:

- Unsupported file types
- Empty documents
- OCR failures
- PDF extraction errors
- Database connection failures
- IBM Bob API failures
- Invalid authentication sessions
- Expired OTPs
- Missing patient information
- PDF generation failures

When information cannot be extracted or is unavailable, the system should explicitly communicate that limitation rather than generating unsupported information.

---

## Privacy Considerations

Medical documents may contain highly sensitive personal and health information.

Users and developers should:

- Only upload documents they are authorized to process.
- Avoid using real patient information in development environments unless appropriate safeguards are in place.
- Protect database credentials.
- Protect API credentials.
- Use HTTPS for deployed applications.
- Restrict access to uploaded files.
- Delete unnecessary medical documents when they are no longer required.
- Follow applicable privacy and data-protection requirements when deploying the application.

> **Important:** This project is intended as a software application and development project. AI-generated summaries and analyses should not be treated as a replacement for professional medical judgment.

---

## Troubleshooting

### PostgreSQL connection fails

Verify that PostgreSQL is running and that `DATABASE_URL` contains the correct:

- Host
- Port
- Username
- Password
- Database name

Example:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/medical_report_ai
```

### OCR is not working

Verify that Tesseract is installed:

```bash
tesseract --version
```

If the command is not recognized, ensure Tesseract is installed and available in the system `PATH`.

### IBM Bob connection fails

Check:

```env
BOB_API_BASE_URL=
BOB_API_KEY=
BOB_MODEL=
```

Also verify that IBM Bob is running and accessible from the backend environment.

### Documents upload but no text is extracted

Check:

- Whether the document contains actual text
- Whether the document is scanned
- Whether Tesseract is installed for image/OCR processing
- Whether the selected file format is supported

---

## Future Improvements

Potential improvements include:

- Multi-patient support
- Advanced medical timeline visualization
- Additional document formats
- Improved OCR preprocessing
- Role-based access control
- Secure cloud storage
- Email/SMS OTP integration
- Audit logging
- Advanced document search
- Additional AI model providers
- Improved PDF report customization
- Production-grade monitoring and logging

---

## License

This project is licensed under the **MIT License**.

See the `LICENSE` file for the complete license text.

---

## Disclaimer

**Medical Report AI is a software and AI-assisted document-processing project.**

The application organizes and summarizes information contained in uploaded medical documents. It does not independently diagnose medical conditions, prescribe medication, or replace a qualified healthcare professional.

Users should consult an appropriate medical professional for diagnosis, treatment decisions, and interpretation of medical information.

---

## Project Name

**Medical Report AI**

**Repository:** `medical-report-ai`

**Primary Technologies:** Python, Flask, PostgreSQL, IBM Bob AI, HTML, CSS, JavaScript
# Medical-Report-Ai
