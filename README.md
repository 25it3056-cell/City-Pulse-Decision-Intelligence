# CityPulse - AI Community Wellness & Decision Intelligence Platform
CityPulse is an AI-powered Decision Intelligence Platform designed to monitor healthcare access, citizen sentiment, and predictive disease outbreaks. It features a fully responsive frontend with a built-in **Design System Theme Switcher** and a lightweight, self-contained REST API backend.
---
## 🎨 Key Features
1. **Healthcare Availability & Reservation**: 
   - Real-time monitoring of bed capacities, appointments, and active on-duty doctors across city sectors.
   - Interactive booking modal to reserve slots instantly.
2. **Interactive Map Overlays**: 
   - Map visualizations powered by **Leaflet.js** showcasing locations of medical centers, density circles for disease outbreak zones, and citizen sentiment heat highlights.
3. **Predictive Outbreak Simulator**: 
   - Tweak environmental parameters (humidity, temperature, and mobility index) to run simulation models.
   - Projecting 8-week infection growth curves dynamically on **Chart.js** line graphs.
4. **Citizen Feedback Portal**: 
   - Labeled citizen sentiment analysis (positive, neutral, negative ratios).
   - Word cloud capturing trending keywords and text submission forms for community wellness reporting.
5. **Dynamic Framework Switcher**: 
   - Instantly swap the layout, typography, borders, and color palettes of the entire dashboard between:
     - **Default Glassmorphic Glow**: Modern translucent cards with neon accents.
     - **Tailwind CSS**: Utility-first slate backgrounds with indigo/violet accents.
     - **Bootstrap**: Classic grey card modules with rounded blue buttons.
     - **Material Design 3**: Google's color-accented design system with elevated surfaces.
     - **Chakra UI**: Sleek flat borders with modern teal branding.
---
## 🏗️ Technology Stack
* **Frontend**: HTML5, Vanilla CSS3 (CSS custom variables, flexbox, CSS grids), Vanilla ES6 JavaScript
* **Libraries**: [Chart.js](https://www.chartjs.org/) (Data Visualization), [Leaflet.js](https://leafletjs.com/) (Interactive Mapping), [FontAwesome](https://fontawesome.com/) (Vector Icons)
* **Backend**: Lightweight native PowerShell HTTP Web Server & REST JSON API
---
## 🚀 How to Run Locally
Since the backend is built natively on PowerShell, **no Node.js, Python, or external installations are required**.
1. **Clone or Open the Folder**:
   Navigate to your local project directory.
2. **Start the Web & API Server**:
   Open a PowerShell window in the project folder and execute:
   ```powershell
   powershell -ExecutionPolicy Bypass -File server.ps1
   ```
3. **Access the Dashboard**:
   Open your browser and navigate to:
   ```
   http://localhost:3000/
   ```
---
## 🔌 API Reference Endpoints
The server hosts a JSON REST API alongside the static client files:
* **GET `/api/hospitals`**: Returns live clinic capacities, beds, and coordinates.
* **GET `/api/outbreaks`**: Returns current infection data and historical cases.
* **GET `/api/sentiment`**: Returns community feedback statistics and comments.
* **POST `/api/simulate`**: Receives temperature/humidity metrics and returns simulated outbreak forecasts.
* **POST `/api/chat`**: AI Assistant chatbot endpoint returning response text and automated search redirects.
* **POST `/api/book`**: Reserves a bed at a clinic, updating database values in-memory.
* **POST `/api/feedback`**: Submits a new citizen text comment, running keywords sentiment analysis.
