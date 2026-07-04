// CityPulse Client Application Engine

// Global State
const state = {
    currentView: 'dashboard',
    hospitals: [],
    outbreaks: {},
    sentiment: {},
    notifications: 3,
    speechActive: false,
    fontSizeAdjustment: 0,
    mapInstance: null,
    mapLayers: {
        clinics: null,
        outbreaks: null,
        sentiment: null
    },
    charts: {
        bedOccupancy: null,
        predictiveOutbreak: null
    }
};

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

// Initialization
async function initApp() {
    setupEventListeners();
    await fetchInitialData();
    renderAll();
    initLeafletMap();
    initCharts();
}

// Event Handlers Setup
function setupEventListeners() {
    // Navigation routing
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            switchView(view);
        });
    });

    // Notification toggling
    const bell = document.getElementById('notification-trigger');
    const dropdown = document.getElementById('notification-dropdown');
    bell.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });
    
    document.addEventListener('click', () => {
        dropdown.classList.remove('active');
    });
    
    document.getElementById('clear-notifications').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('notification-list').innerHTML = `
            <li class="alert-item info" style="justify-content: center; text-align: center; color: var(--text-secondary);">
                No active notifications.
            </li>
        `;
        document.querySelector('.bell-badge').style.display = 'none';
        state.notifications = 0;
    });

    // Global NL Search Bar
    const searchBar = document.getElementById('global-search');
    searchBar.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleGlobalSearch(searchBar.value);
        }
    });

    // Float Chat Widget events
    const floatBtn = document.getElementById('chat-float-btn-trigger');
    const chatContainer = document.getElementById('ai-chat-container');
    const chatClose = document.getElementById('chat-close');
    const chatToggleSize = document.getElementById('chat-toggle-size');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input-field');

    floatBtn.addEventListener('click', () => {
        chatContainer.classList.remove('collapsed');
        floatBtn.style.display = 'none';
        setTimeout(() => chatInput.focus(), 150);
    });

    chatClose.addEventListener('click', () => {
        chatContainer.classList.add('collapsed');
        floatBtn.style.display = 'flex';
    });

    chatToggleSize.addEventListener('click', () => {
        chatContainer.classList.toggle('expanded');
        chatToggleSize.querySelector('i').classList.toggle('fa-expand');
        chatToggleSize.querySelector('i').classList.toggle('fa-compress');
    });

    chatSendBtn.addEventListener('click', submitChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitChatMessage();
    });

    // Feedback submission
    const feedbackForm = document.getElementById('feedback-form');
    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = document.getElementById('fb-text').value;
        const sector = document.getElementById('fb-sector').value;
        
        try {
            const res = await fetch('http://localhost:3000/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, sector })
            });
            if (res.ok) {
                const updatedSentiment = await res.json();
                state.sentiment = updatedSentiment;
                renderSentiment();
                showToast('Wellness report submitted successfully!', 'success');
                document.getElementById('fb-text').value = '';
            }
        } catch (err) {
            console.error('Failed to submit feedback', err);
            showToast('API offline. Using local simulated submission.', 'error');
            // Local fallback
            state.sentiment.comments.unshift({
                text,
                sentiment: text.includes('good') ? 'positive' : 'neutral',
                timestamp: 'Just now',
                sector
            });
            renderSentiment();
        }
    });

    // Booking modal controls
    document.getElementById('close-booking-modal').addEventListener('click', () => {
        document.getElementById('booking-modal').classList.remove('active');
    });
    document.getElementById('btn-cancel-booking').addEventListener('click', () => {
        document.getElementById('booking-modal').classList.remove('active');
    });
    
    const bookingForm = document.getElementById('booking-form');
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const hospitalId = document.getElementById('booking-hospital-id').value;
        const patientName = document.getElementById('book-patient-name').value;
        const symptoms = document.getElementById('book-symptoms').value;
        
        try {
            const res = await fetch('http://localhost:3000/api/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hospitalId, patientName, symptoms })
            });
            const data = await res.json();
            if (data.success) {
                state.hospitals = data.hospitals;
                renderHospitalsTable();
                updateKpiBeds();
                showToast(`Bed reserved successfully for ${patientName}!`, 'success');
                document.getElementById('booking-modal').classList.remove('active');
                bookingForm.reset();
            } else {
                showToast(data.message, 'error');
            }
        } catch (err) {
            console.error('Failed to book appointment', err);
            showToast('Unable to complete reservation: API disconnected.', 'error');
        }
    });

    // Simulation Trigger
    document.getElementById('btn-run-simulation').addEventListener('click', runSimulation);

    // Simulator slider labels
    setupSliderLabel('sim-humidity', 'slider-val-humidity', '%');
    setupSliderLabel('sim-mobility', 'slider-val-mobility', 'x', 0.1);
    setupSliderLabel('sim-temp', 'slider-val-temp', '°C');

    // Settings listeners
    document.getElementById('setting-high-contrast').addEventListener('change', (e) => {
        document.body.classList.toggle('high-contrast', e.target.checked);
    });

    document.getElementById('setting-speech').addEventListener('change', (e) => {
        state.speechActive = e.target.checked;
        if (state.speechActive) {
            speakText("CityPulse voice synthesizer enabled. Ready to announce wellness reports.");
        }
    });

    document.getElementById('btn-reset-db').addEventListener('click', async () => {
        showToast("Restoring database to default models...", "success");
        setTimeout(async () => {
            window.location.reload();
        }, 1000);
    });

    // Map overlay toggle listeners
    document.getElementById('layer-clinics').addEventListener('change', (e) => {
        toggleMapLayer('clinics', e.target.checked);
    });
    document.getElementById('layer-outbreaks').addEventListener('change', (e) => {
        toggleMapLayer('outbreaks', e.target.checked);
    });
    document.getElementById('layer-sentiment').addEventListener('change', (e) => {
        toggleMapLayer('sentiment', e.target.checked);
    });

    // Design System Switcher Listeners
    const pickerItems = document.querySelectorAll('#design-system-list .design-item');
    const settingsSelector = document.getElementById('setting-design-system');
    
    pickerItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const theme = item.getAttribute('data-theme');
            applyDesignSystemTheme(theme);
        });
    });

    if (settingsSelector) {
        settingsSelector.addEventListener('change', (e) => {
            applyDesignSystemTheme(e.target.value);
        });
    }
}

// Fetch Initial data from local API
async function fetchInitialData() {
    try {
        const [hospRes, outRes, sentRes] = await Promise.all([
            fetch('http://localhost:3000/api/hospitals'),
            fetch('http://localhost:3000/api/outbreaks'),
            fetch('http://localhost:3000/api/sentiment')
        ]);
        
        state.hospitals = await hospRes.json();
        state.outbreaks = await outRes.json();
        state.sentiment = await sentRes.json();
    } catch (err) {
        console.error("API is offline. Falling back to client-side static mock simulation.", err);
        showToast("API server offline. Running in local simulation mode.", "error");
        
        // Fallback static mock
        state.hospitals = [
            { id: "h1", name: "Metro General Hospital", sector: "Sector 1 (Downtown)", totalBeds: 120, availableBeds: 14, appointments: 45, doctors: 18, lat: 40.7128, lng: -74.0060, type: "General Hospital" },
            { id: "h2", name: "St. Jude Wellness Clinic", sector: "Sector 3 (Northside)", totalBeds: 45, availableBeds: 19, appointments: 12, doctors: 6, lat: 40.7306, lng: -73.9352, type: "Community Clinic" },
            { id: "h3", name: "Valley Children Health", sector: "Sector 5 (East End)", totalBeds: 60, availableBeds: 2, appointments: 28, doctors: 9, lat: 40.7589, lng: -73.9851, type: "Pediatric Clinic" },
            { id: "h4", name: "Beacon Community Health", sector: "Sector 2 (West Hills)", totalBeds: 35, availableBeds: 24, appointments: 8, doctors: 4, lat: 40.7061, lng: -74.0170, type: "Community Clinic" },
            { id: "h5", name: "Sector 4 Urgent Care", sector: "Sector 4 (Southside)", totalBeds: 20, availableBeds: 8, appointments: 15, doctors: 5, lat: 40.6782, lng: -73.9442, type: "Urgent Care" }
        ];
        state.outbreaks = {
            currentWeek: 26,
            diseases: [
                { name: "Influenza", currentCases: 142, riskLevel: "Moderate", color: "amber", history: [45, 52, 60, 75, 90, 110, 118, 142] },
                { name: "Dengue", currentCases: 38, riskLevel: "High", color: "coral", history: [2, 4, 8, 12, 15, 22, 28, 38] },
                { name: "Gastroenteritis", currentCases: 64, riskLevel: "Low", color: "emerald", history: [80, 85, 78, 70, 74, 68, 72, 64] }
            ]
        };
        state.sentiment = {
            score: 72,
            totalFeedbacks: 412,
            breakdown: { positive: 60, neutral: 25, negative: 15 },
            comments: [
                { text: "St. Jude Clinic has very polite staff. Got checkup in 15 minutes.", sentiment: "positive", timestamp: "2 hours ago", sector: "Sector 3" },
                { text: "Long waiting lines at Valley Children Hospital. Only 2 pediatricians on duty.", sentiment: "negative", timestamp: "4 hours ago", sector: "Sector 5" }
            ],
            keywords: [
                { text: "App booking", count: 48 },
                { text: "Bed shortage", count: 32 },
                { text: "Friendly staff", count: 55 },
                { text: "Wait time", count: 61 }
            ]
        };
    }
}

// Router Switch View
function switchView(viewName) {
    state.currentView = viewName;
    
    // Manage sidebar active class
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-view') === viewName) {
            item.classList.add('active');
        }
    });

    // Manage views visibility
    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.remove('active');
    });
    
    const activeView = document.getElementById(`view-${viewName}`);
    if (activeView) {
        activeView.classList.add('active');
    }

    // Leaflet map refresh needed when container becomes visible
    if (viewName === 'map' && state.mapInstance) {
        setTimeout(() => {
            state.mapInstance.invalidateSize();
        }, 100);
    }
    
    speakViewAnnouncement(viewName);
}

// Search bar NLP engine
function handleGlobalSearch(query) {
    if (!query) return;
    const lowerQuery = query.toLowerCase().trim();
    speakText(`Searching for ${query}`);

    // Check if user is routing
    if (lowerQuery.includes('map') || lowerQuery.includes('location') || lowerQuery.includes('where')) {
        switchView('map');
        return;
    }
    if (lowerQuery.includes('predict') || lowerQuery.includes('simulation') || lowerQuery.includes('forecast')) {
        switchView('predictions');
        return;
    }
    if (lowerQuery.includes('feedback') || lowerQuery.includes('citizen') || lowerQuery.includes('comment')) {
        switchView('feedback');
        return;
    }
    if (lowerQuery.includes('setting') || lowerQuery.includes('contrast')) {
        switchView('settings');
        return;
    }

    // Default route to dashboard and filter/scroll
    switchView('dashboard');
    
    // Match clinic
    const clinicsTable = document.getElementById('hospitals-table-body');
    const rows = clinicsTable.querySelectorAll('tr');
    let matched = false;
    
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        if (text.includes(lowerQuery)) {
            row.style.background = 'rgba(0, 242, 254, 0.15)';
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            matched = true;
            setTimeout(() => {
                row.style.background = '';
            }, 3000);
        }
    });

    if (matched) {
        showToast("Filtered matches in Availability Table.", "success");
    } else {
        // Run AI search simulation in chat assistant
        const floatBtn = document.getElementById('chat-float-btn-trigger');
        floatBtn.click();
        sendQuickMessage(query);
    }
}

// Render values into elements
function renderAll() {
    updateKpiBeds();
    renderKpiSentiment();
    renderHospitalsTable();
    renderDiseaseAlerts();
    renderSentiment();
}

function updateKpiBeds() {
    const total = state.hospitals.reduce((acc, h) => acc + h.availableBeds, 0);
    const totalBedsCount = state.hospitals.reduce((acc, h) => acc + h.totalBeds, 0);
    const freePercentage = Math.round((total / totalBedsCount) * 100);
    
    document.getElementById('kpi-beds-value').innerText = total;
    document.querySelector('#kpi-beds-value + .kpi-subtext span').innerText = `${freePercentage}% capacity free`;
}

function renderKpiSentiment() {
    document.getElementById('kpi-sentiment-value').innerText = `${state.sentiment.score}%`;
}

function renderHospitalsTable() {
    const tbody = document.getElementById('hospitals-table-body');
    tbody.innerHTML = '';
    
    state.hospitals.forEach(h => {
        const occupancyRate = Math.round(((h.totalBeds - h.availableBeds) / h.totalBeds) * 100);
        let progressColor = 'safe';
        if (occupancyRate > 90) progressColor = 'critical';
        else if (occupancyRate > 70) progressColor = 'warning';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="font-weight: 600; color: #ffffff;">${h.name}</div>
                <div class="clinic-type">${h.type}</div>
            </td>
            <td><i class="fa-solid fa-location-dot" style="color: var(--primary-color);"></i> ${h.sector}</td>
            <td>
                <div class="capacity-indicator-bar">
                    <div class="capacity-progress ${progressColor}" style="width: ${occupancyRate}%"></div>
                </div>
                <span class="text-muted" style="font-size: 12px;">${occupancyRate}% Occupied</span>
            </td>
            <td style="font-weight: 700;" class="${h.availableBeds < 5 ? 'alert-coral-text' : 'green-text'}">${h.availableBeds}</td>
            <td><i class="fa-solid fa-user-doctor"></i> ${h.doctors}</td>
            <td>
                <button class="action-btn small" onclick="openBookingModal('${h.id}', '${h.name}')" ${h.availableBeds === 0 ? 'disabled' : ''}>
                    ${h.availableBeds === 0 ? 'Full' : 'Book Bed'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderDiseaseAlerts() {
    const container = document.getElementById('disease-list-container');
    container.innerHTML = '';
    
    state.outbreaks.diseases.forEach(d => {
        const div = document.createElement('div');
        div.className = 'disease-card';
        div.innerHTML = `
            <div class="disease-info">
                <h4>${d.name}</h4>
                <p class="disease-stat">${d.currentCases} active cases in monitoring</p>
            </div>
            <div class="disease-badge ${d.color}">${d.riskLevel} Risk</div>
        `;
        container.appendChild(div);
    });
    
    // Update KPI Card
    const highestRisk = state.outbreaks.diseases.reduce((acc, d) => {
        if (d.riskLevel === 'High') return 'High';
        if (d.riskLevel === 'Moderate' && acc !== 'High') return 'Moderate';
        return acc;
    }, 'Low');
    
    const kpiOutbreak = document.getElementById('kpi-outbreak-value');
    kpiOutbreak.innerText = highestRisk;
    kpiOutbreak.className = highestRisk === 'High' ? 'kpi-value alert-coral-text' : 'kpi-value green-text';
}

function renderSentiment() {
    // Score displayed
    document.getElementById('sentiment-score-display').innerText = `${state.sentiment.score}%`;
    renderKpiSentiment();

    // Breakdown bars
    const breakdown = state.sentiment.breakdown;
    document.getElementById('bar-positive').style.width = `${breakdown.positive}%`;
    document.getElementById('bar-neutral').style.width = `${breakdown.neutral}%`;
    document.getElementById('bar-negative').style.width = `${breakdown.negative}%`;
    
    document.getElementById('lbl-val-pos').innerText = breakdown.positive;
    document.getElementById('lbl-val-neu').innerText = breakdown.neutral;
    document.getElementById('lbl-val-neg').innerText = breakdown.negative;

    // Comments list
    const commentsList = document.getElementById('feedback-comments-list');
    commentsList.innerHTML = '';
    
    state.sentiment.comments.forEach(c => {
        const div = document.createElement('div');
        div.className = 'comment-card';
        div.innerHTML = `
            <div class="comment-header">
                <span class="comment-sector"><i class="fa-solid fa-map-location-dot"></i> ${c.sector}</span>
                <span class="comment-meta">${c.timestamp}</span>
            </div>
            <p class="comment-body">"${c.text}"</p>
            <span class="comment-badge ${c.sentiment}">${c.sentiment.toUpperCase()}</span>
        `;
        commentsList.appendChild(div);
    });

    // Word tags
    const cloud = document.getElementById('keyword-cloud-tags');
    cloud.innerHTML = '';
    state.sentiment.keywords.forEach(k => {
        const span = document.createElement('span');
        span.className = 'keyword-tag';
        span.innerHTML = `${k.text} <span class="tag-count">${k.count}</span>`;
        cloud.appendChild(span);
    });
}

// Leaflet Map Setup
function initLeafletMap() {
    // Coordinates default in center of clinics (Downtown Sector 1)
    const map = L.map('leaflet-map-element', {
        zoomControl: false
    }).setView([40.7128, -73.9851], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    
    state.mapInstance = map;

    // Feature Groups for overlays
    state.mapLayers.clinics = L.featureGroup().addTo(map);
    state.mapLayers.outbreaks = L.featureGroup().addTo(map);
    state.mapLayers.sentiment = L.featureGroup().addTo(map);

    // Render Markers
    renderMapElements();
}

function renderMapElements() {
    if (!state.mapInstance) return;
    
    // Clear existing
    state.mapLayers.clinics.clearLayers();
    state.mapLayers.outbreaks.clearLayers();
    state.mapLayers.sentiment.clearLayers();

    // 1. Clinics Markers
    state.hospitals.forEach(h => {
        const marker = L.circleMarker([h.lat, h.lng], {
            radius: 8,
            fillColor: '#4facfe',
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        });
        marker.bindPopup(`
            <div style="font-family: 'Inter', sans-serif; color: #333;">
                <h4 style="margin:0 0 4px 0; font-family: 'Outfit'; font-weight:700;">${h.name}</h4>
                <p style="margin:0; font-size:11px;">Beds Available: <b>${h.availableBeds}</b></p>
                <p style="margin:0; font-size:11px;">Doctors On-Duty: <b>${h.doctors}</b></p>
            </div>
        `);
        state.mapLayers.clinics.addLayer(marker);
    });

    // 2. Outbreaks Circles (mocked density near sectors)
    const outbreakCoords = [
        { lat: 40.6782, lng: -73.9442, cases: 38, name: "Dengue outbreak zone" }, // Sector 4
        { lat: 40.7589, lng: -73.9851, cases: 142, name: "Influenza infection concentration" } // Sector 5
    ];
    outbreakCoords.forEach(out => {
        const circle = L.circle([out.lat, out.lng], {
            color: '#ff4b6e',
            fillColor: '#ff4b6e',
            fillOpacity: 0.3,
            radius: out.cases * 12
        });
        circle.bindPopup(`
            <div style="font-family: 'Inter', sans-serif; color: #333;">
                <h4 style="margin:0; color: #ff4b6e; font-family: 'Outfit';">${out.name}</h4>
                <p style="margin:4px 0 0 0; font-size:11px;">Monitored active cases: <b>${out.cases}</b></p>
            </div>
        `);
        state.mapLayers.outbreaks.addLayer(circle);
    });

    // 3. Sentiment Hotspots (glows in green/red)
    state.hospitals.forEach(h => {
        const score = h.availableBeds > 5 ? 85 : 45;
        const color = score > 60 ? '#00df89' : '#ff4b6e';
        const heat = L.circle([h.lat + 0.005, h.lng - 0.005], {
            stroke: false,
            fillColor: color,
            fillOpacity: 0.15,
            radius: 800
        });
        state.mapLayers.sentiment.addLayer(heat);
    });
}

function toggleMapLayer(layerName, isVisible) {
    if (!state.mapInstance) return;
    const layer = state.mapLayers[layerName];
    if (isVisible) {
        state.mapInstance.addLayer(layer);
    } else {
        state.mapInstance.removeLayer(layer);
    }
}

// Chart.js plots Setup
function initCharts() {
    // 1. Bed Occupancy Chart
    const ctxBeds = document.getElementById('bedOccupancyChart').getContext('2d');
    state.charts.bedOccupancy = new Chart(ctxBeds, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Occupancy Rate (%)',
                data: [68, 71, 74, 73, 76, 78, 77],
                borderColor: '#00f2fe',
                backgroundColor: 'rgba(0, 242, 254, 0.05)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 100, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } },
                x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
            }
        }
    });

    // 2. Outbreak Predictive projection Chart
    const ctxOutbreak = document.getElementById('outbreakPredictiveChart').getContext('2d');
    state.charts.predictiveOutbreak = new Chart(ctxOutbreak, {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8 (Proj)'],
            datasets: [
                {
                    label: 'Influenza Cases',
                    data: [45, 52, 60, 75, 90, 110, 118, 142],
                    borderColor: '#ffa600',
                    backgroundColor: 'rgba(255, 166, 0, 0.05)',
                    borderWidth: 2,
                    tension: 0.3
                },
                {
                    label: 'Dengue Cases',
                    data: [2, 4, 8, 12, 15, 22, 28, 38],
                    borderColor: '#ff4b6e',
                    backgroundColor: 'rgba(255, 75, 110, 0.05)',
                    borderWidth: 2,
                    tension: 0.3
                },
                {
                    label: 'Gastroenteritis Cases',
                    data: [80, 85, 78, 70, 74, 68, 72, 64],
                    borderColor: '#00df89',
                    backgroundColor: 'rgba(0, 223, 137, 0.05)',
                    borderWidth: 2,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#ffffff' } } },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } },
                x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
            }
        }
    });
}

// Run Simulation REST API call
async function runSimulation() {
    const humidityVal = document.getElementById('sim-humidity').value / 100;
    const mobilityVal = document.getElementById('sim-mobility').value / 10;
    const tempVal = document.getElementById('sim-temp').value;

    showToast("Running complex mathematical disease models...", "success");

    try {
        const res = await fetch('http://localhost:3000/api/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                humidity: humidityVal,
                mobility: mobilityVal,
                temperature: tempVal
            })
        });
        const updatedOutbreaks = await res.json();
        
        // Update local state
        state.outbreaks = updatedOutbreaks;
        renderDiseaseAlerts();
        updateSimulationCharts();
        
        // Dynamic notification of risks
        triggerOutbreakNotifications();
        
    } catch (err) {
        console.error("Simulation endpoint error, calculating local simulation fallback.", err);
        // Local calculation fallback
        const dengueVal = Math.round(10 + (humidityVal * 35) + (tempVal > 25 ? (tempVal - 25) * 3 : 0));
        const fluVal = Math.round(60 + (mobilityVal * 60) + (tempVal < 20 ? (20 - tempVal) * 8 : 0));
        const gastroVal = Math.round(40 + (tempVal > 28 ? (tempVal - 28) * 6 : 0) + (humidityVal * 20));

        state.outbreaks.diseases.forEach(d => {
            if (d.name === 'Dengue') {
                d.currentCases = dengueVal;
                d.history = d.history.slice(1).concat(dengueVal);
                d.riskLevel = dengueVal > 50 ? 'High' : 'Moderate';
            }
            if (d.name === 'Influenza') {
                d.currentCases = fluVal;
                d.history = d.history.slice(1).concat(fluVal);
                d.riskLevel = fluVal > 120 ? 'High' : 'Moderate';
            }
            if (d.name === 'Gastroenteritis') {
                d.currentCases = gastroVal;
                d.history = d.history.slice(1).concat(gastroVal);
                d.riskLevel = gastroVal > 80 ? 'High' : 'Low';
            }
        });
        
        renderDiseaseAlerts();
        updateSimulationCharts();
    }
}

function updateSimulationCharts() {
    if (!state.charts.predictiveOutbreak) return;
    
    // For each disease, map the history array to dataset data
    state.outbreaks.diseases.forEach((d, idx) => {
        state.charts.predictiveOutbreak.data.datasets[idx].data = d.history;
    });
    
    state.charts.predictiveOutbreak.update();
    renderMapElements(); // Redraw map circles as cases shifted
}

function triggerOutbreakNotifications() {
    const list = document.getElementById('notification-list');
    const badge = document.querySelector('.bell-badge');
    
    let html = '';
    let notificationCount = 0;
    
    state.outbreaks.diseases.forEach(d => {
        if (d.riskLevel === 'High') {
            notificationCount++;
            html += `
                <li class="alert-item critical">
                    <div class="alert-icon"><i class="fa-solid fa-biohazard"></i></div>
                    <div class="alert-info">
                        <p class="alert-title">Simulated High ${d.name} Risk</p>
                        <p class="alert-desc">Simulated active cases climbed to ${d.currentCases}. Immediate preventive measures advised.</p>
                        <span class="alert-time">Just now</span>
                    </div>
                </li>
            `;
        }
    });

    if (notificationCount > 0) {
        list.innerHTML = html + list.innerHTML;
        state.notifications += notificationCount;
        badge.innerText = state.notifications;
        badge.style.display = 'block';
        showToast(`AI Warning: High disease transmission risks simulated!`, 'error');
    }
}

// Chatbot Assist Send
async function submitChatMessage() {
    const input = document.getElementById('chat-input-field');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    appendMessage(msg, 'user');
    showTypingIndicator();

    try {
        const res = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        
        hideTypingIndicator();
        appendMessage(data.reply, 'bot');
        
        // Execute dynamic search routing if requested
        if (data.action === 'navigate' && data.target) {
            setTimeout(() => switchView(data.target), 1200);
        }
    } catch (err) {
        console.error("AI Assistant disconnected.", err);
        hideTypingIndicator();
        
        // Client-side chatbot reply fallback
        setTimeout(() => {
            let fallbackReply = "I'm running in local mode since the API is offline. I can assist with layout switching! Try typing: 'open maps', 'feedback page', 'predictions page'.";
            
            const lowMsg = msg.toLowerCase();
            if (lowMsg.includes('map') || lowMsg.includes('location')) {
                fallbackReply = "Sure! Redirecting you to the Wellness Map view now.";
                switchView('map');
            } else if (lowMsg.includes('predict') || lowMsg.includes('simulation') || lowMsg.includes('outbreak')) {
                fallbackReply = "Loading the Disease Predictions simulator tab.";
                switchView('predictions');
            } else if (lowMsg.includes('feedback') || lowMsg.includes('sentiment') || lowMsg.includes('citizen')) {
                fallbackReply = "Here is the citizen satisfaction panel.";
                switchView('feedback');
            } else if (lowMsg.includes('bed') || lowMsg.includes('clinic')) {
                fallbackReply = "Showing hospital bed allocations page.";
                switchView('dashboard');
            }
            
            appendMessage(fallbackReply, 'bot');
        }, 600);
    }
}

function sendQuickMessage(txt) {
    document.getElementById('chat-input-field').value = txt;
    submitChatMessage();
}

function appendMessage(text, sender) {
    const body = document.getElementById('chat-body-scroll');
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}`;
    msgDiv.innerHTML = `<p>${text}</p>`;
    
    // Append before input indicators
    const typing = body.querySelector('.typing-indicator');
    if (typing) {
        body.insertBefore(msgDiv, typing);
    } else {
        body.appendChild(msgDiv);
    }
    
    body.scrollTop = body.scrollHeight;
    if (sender === 'bot') {
        speakText(text);
    }
}

function showTypingIndicator() {
    const body = document.getElementById('chat-body-scroll');
    if (body.querySelector('.typing-indicator')) return;
    
    const div = document.createElement('div');
    div.className = 'typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}

function hideTypingIndicator() {
    const body = document.getElementById('chat-body-scroll');
    const div = body.querySelector('.typing-indicator');
    if (div) div.remove();
}

// Modal open booking
function openBookingModal(hospitalId, hospitalName) {
    document.getElementById('booking-hospital-id').value = hospitalId;
    document.getElementById('booking-facility-summary').innerText = `Reserving patient admission bed at ${hospitalName}.`;
    document.getElementById('booking-modal').classList.add('active');
    setTimeout(() => {
        document.getElementById('book-patient-name').focus();
    }, 200);
}

// Universal Helper tools
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast-notification');
    const msgText = document.getElementById('toast-msg-text');
    const icon = document.getElementById('toast-icon-div');
    
    msgText.innerText = msg;
    toast.className = `toast active ${type}`;
    
    if (type === 'success') {
        icon.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
    } else {
        icon.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>`;
    }
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 4000);
}

function setupSliderLabel(sliderId, labelId, suffix, multiplier = 1) {
    const slider = document.getElementById(sliderId);
    const label = document.getElementById(labelId);
    slider.addEventListener('input', () => {
        const val = (slider.value * multiplier).toFixed(multiplier === 1 ? 0 : 1);
        label.innerText = `${val}${suffix}`;
    });
}

function applyRecommendation(action) {
    if (action === 'reallocate') {
        // Find beacon and shift beds
        const beacon = state.hospitals.find(h => h.id === 'h4');
        const children = state.hospitals.find(h => h.id === 'h3');
        if (beacon.availableBeds > 5) {
            beacon.availableBeds -= 5;
            children.availableBeds += 5;
            renderHospitalsTable();
            updateKpiBeds();
            showToast("Successfully transferred 5 emergency beds to Valley Children Health.", "success");
        } else {
            showToast("Unable to transfer beds: Beacon capacity is low.", "error");
        }
    } else if (action === 'spraying') {
        showToast("Sanitation spraying units deployed to Sector 4 Southside.", "success");
        // Lower Dengue cases locally as simulation benefit
        const dengue = state.outbreaks.diseases.find(d => d.name === 'Dengue');
        if (dengue) {
            dengue.currentCases = Math.max(10, dengue.currentCases - 12);
            dengue.riskLevel = dengue.currentCases > 25 ? 'Moderate' : 'Low';
            dengue.history = dengue.history.slice(0, -1).concat(dengue.currentCases);
            renderDiseaseAlerts();
            updateSimulationCharts();
        }
    }
}

// Accessibility Utilities
function adjustFontSize(step) {
    const normalBtn = document.getElementById('font-btn-normal');
    
    if (step === 0) {
        state.fontSizeAdjustment = 0;
        document.documentElement.style.fontSize = '16px';
        document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
        normalBtn.classList.add('active');
    } else {
        state.fontSizeAdjustment = Math.max(-4, Math.min(8, state.fontSizeAdjustment + step));
        const newSize = 16 + state.fontSizeAdjustment;
        document.documentElement.style.fontSize = `${newSize}px`;
        
        document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
        if (state.fontSizeAdjustment > 0) {
            document.querySelectorAll('.font-btn')[2].classList.add('active');
        } else {
            document.querySelectorAll('.font-btn')[0].classList.add('active');
        }
    }
}

function speakText(text) {
    if (!state.speechActive) return;
    try {
        // Strip markdown stars for synthesis clarity
        const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.error("Text-to-speech failed", e);
    }
}

function speakViewAnnouncement(viewName) {
    if (!state.speechActive) return;
    const announcements = {
        dashboard: "Navigated to Health Services Dashboard. Bed availability and alert status loaded.",
        map: "Opened Interactive Wellness Map. Touch layers to explore.",
        predictions: "Entered Outbreak Predictive Simulator. Adjust humidity, mobility and temperature sliders.",
        feedback: "Loaded Citizen feedback comments. Overall score is seventy-two percent.",
        settings: "Opened Settings pane. Adjust visual scale or high contrast modes."
    };
    if (announcements[viewName]) {
        speakText(announcements[viewName]);
    }
}

// Dynamic Design System Swapping
function applyDesignSystemTheme(theme) {
    // Clear other themes
    document.body.classList.remove('theme-tailwind', 'theme-bootstrap', 'theme-material', 'theme-chakra');
    
    // Add theme class if not default
    if (theme !== 'default') {
        document.body.classList.add(`theme-${theme}`);
    }

    // Synchronize selector labels
    const settingsSelector = document.getElementById('setting-design-system');
    if (settingsSelector) settingsSelector.value = theme;

    const pickerText = document.getElementById('picker-selected-text');
    const themeLabels = {
        default: 'Glassmorphism',
        tailwind: 'Tailwind CSS',
        bootstrap: 'Bootstrap',
        material: 'Material Design 3',
        chakra: 'Chakra UI'
    };
    if (pickerText) pickerText.innerText = themeLabels[theme] || 'Glassmorphism';

    // Synchronize picker items active class
    document.querySelectorAll('#design-system-list .design-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-theme') === theme) {
            item.classList.add('active');
        }
    });

    // Update Chart.js themes dynamically
    recolorChartsForTheme(theme);

    // Dynamic speech feedback
    if (state.speechActive) {
        speakText(`Switched user interface framework context to ${themeLabels[theme]}.`);
    }

    showToast(`Styling converted to ${themeLabels[theme]} framework guidelines.`, 'success');
}

function recolorChartsForTheme(theme) {
    const bedChart = state.charts.bedOccupancy;
    const outbreakChart = state.charts.predictiveOutbreak;

    if (!bedChart || !outbreakChart) return;

    // Colors mapping
    const themeColors = {
        default: {
            primary: '#00f2fe',
            bg: 'rgba(0, 242, 254, 0.05)',
            flu: '#ffa600',
            dengue: '#ff4b6e',
            gastro: '#00df89',
            text: '#9ca3af'
        },
        tailwind: {
            primary: '#6366f1',
            bg: 'rgba(99, 102, 241, 0.05)',
            flu: '#f59e0b',
            dengue: '#ef4444',
            gastro: '#10b981',
            text: '#94a3b8'
        },
        bootstrap: {
            primary: '#0d6efd',
            bg: 'rgba(13, 110, 253, 0.05)',
            flu: '#ffc107',
            dengue: '#dc3545',
            gastro: '#198754',
            text: '#adb5bd'
        },
        material: {
            primary: '#b39ddb',
            bg: 'rgba(179, 157, 219, 0.05)',
            flu: '#ffe082',
            dengue: '#ff8a80',
            gastro: '#a5d6a7',
            text: '#cac4d0'
        },
        chakra: {
            primary: '#4fd1c5',
            bg: 'rgba(79, 209, 197, 0.05)',
            flu: '#ecc94b',
            dengue: '#f56565',
            gastro: '#48bb78',
            text: '#cbd5e0'
        }
    };

    const colors = themeColors[theme] || themeColors.default;

    // 1. Update Bed Occupancy Chart
    bedChart.data.datasets[0].borderColor = colors.primary;
    bedChart.data.datasets[0].backgroundColor = colors.bg;
    bedChart.options.scales.x.ticks.color = colors.text;
    bedChart.options.scales.y.ticks.color = colors.text;
    bedChart.update();

    // 2. Update Outbreak Chart
    outbreakChart.data.datasets[0].borderColor = colors.flu;
    outbreakChart.data.datasets[0].backgroundColor = colors.flu + '10'; // alpha
    outbreakChart.data.datasets[1].borderColor = colors.dengue;
    outbreakChart.data.datasets[1].backgroundColor = colors.dengue + '10';
    outbreakChart.data.datasets[2].borderColor = colors.gastro;
    outbreakChart.data.datasets[2].backgroundColor = colors.gastro + '10';
    
    outbreakChart.options.scales.x.ticks.color = colors.text;
    outbreakChart.options.scales.y.ticks.color = colors.text;
    if (outbreakChart.options.plugins.legend.labels) {
        outbreakChart.options.plugins.legend.labels.color = colors.text;
    }
    outbreakChart.update();
}
