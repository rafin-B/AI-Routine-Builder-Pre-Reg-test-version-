document.addEventListener('DOMContentLoaded', () => {
    let allCourses = {};
    let selectedCourses = new Set();

    const themeToggleBtn = document.getElementById('theme-toggle');
    const courseSearchInput = document.getElementById('course-search');
    const addCourseBtn = document.getElementById('add-course-btn');
    const selectedCoursesList = document.getElementById('selected-courses-list');
    const preferredDaysContainer = document.getElementById('preferred-days');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const generateBtn = document.getElementById('generate-btn');
    const suggestionsContainer = document.getElementById('suggestions-container');
    const finalRoutineContainer = document.getElementById('final-routine-container');
    const downloadBtn = document.getElementById('downloadTable');
    const loadingIndicator = document.getElementById('loading');
    const searchSuggestions = document.getElementById('search-suggestions');

    // --- Theme Logic ---
    const applyTheme = (theme) => {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            themeToggleBtn.textContent = '🌙';
        } else {
            document.body.classList.remove('light-mode');
            themeToggleBtn.textContent = '☀️';
        }
    };

    const toggleTheme = () => {
        const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    };

    const initializeTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyTheme(savedTheme || (systemPrefersDark ? 'dark' : 'light'));
    };
    
    // --- Core Application Logic ---
    async function initialize() {
        initializeTheme();
        try {
            loadingIndicator.classList.remove('hidden');
            const response = await fetch('https://usis-cdn.eniamza.com/connect.json');
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            const scheduleData = await response.json();
            processScheduleData(scheduleData);
            loadingIndicator.classList.add('hidden');
        } catch (error) {
            loadingIndicator.innerText = "Failed to load course data. Please try refreshing.";
            console.error("Failed to fetch schedule data:", error);
        }
    }
    
    function processScheduleData(data) {
        data.forEach((sectionData, index) => {
            const scheduleString = `${sectionData.preRegSchedule || ''} ${sectionData.preRegLabSchedule || ''}`;
            const times = parseScheduleString(scheduleString); // Use the robust parser
            
            const section = {
                id: index,
                courseCode: sectionData.courseCode,
                sectionName: sectionData.sectionName,
                faculty: sectionData.faculties,
                times: times,
                capacity: sectionData.capacity,
                consumedSeat: sectionData.consumedSeat,
                rawSchedule: (sectionData.preRegSchedule || '').replace(/\n/g, ' ')
            };

            if (!allCourses[section.courseCode]) {
                allCourses[section.courseCode] = [];
            }
            allCourses[section.courseCode].push(section);
        });
    }

    function addCourse(courseCode) {
        const code = courseCode.toUpperCase().trim();
        if (code && allCourses[code] && !selectedCourses.has(code)) {
            selectedCourses.add(code);
            renderSelectedCourses();
        } else if (selectedCourses.has(code)) {
            alert("Course already added.");
        } else {
            alert("Course not found or invalid.");
        }
    }

    function renderSelectedCourses() {
        selectedCoursesList.innerHTML = '';
        selectedCourses.forEach(code => {
            const li = document.createElement('li');
            li.className = 'selected-course-item';
            li.textContent = code;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-course-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => {
                selectedCourses.delete(code);
                renderSelectedCourses();
            };
            li.appendChild(removeBtn);
            selectedCoursesList.appendChild(li);
        });
    }

    function handleSearchInput() {
        const query = courseSearchInput.value.toUpperCase().trim();
        searchSuggestions.innerHTML = '';
        if (query.length < 2) {
            searchSuggestions.classList.add('hidden');
            return;
        }
        const matches = Object.keys(allCourses).filter(code =>
            code.startsWith(query) && !selectedCourses.has(code)
        );
        if (matches.length > 0) {
            matches.slice(0, 7).forEach(code => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.textContent = code;
                item.onclick = () => {
                    addCourse(code);
                    courseSearchInput.value = '';
                    searchSuggestions.classList.add('hidden');
                };
                searchSuggestions.appendChild(item);
            });
            searchSuggestions.classList.remove('hidden');
        } else {
            searchSuggestions.classList.add('hidden');
        }
    }

    function generateRoutines() {
        if (selectedCourses.size === 0) {
            alert("Please add at least one course.");
            return;
        }
        loadingIndicator.classList.remove('hidden');
        suggestionsContainer.innerHTML = '';
        finalRoutineContainer.classList.add('hidden');
        
        setTimeout(() => {
            const routineGenerator = new RoutineGenerator(allCourses, Array.from(selectedCourses), {
                days: Array.from(preferredDaysContainer.querySelectorAll('input:checked')).map(cb => cb.value),
                startTime: startTimeInput.value,
                endTime: endTimeInput.value
            });
            const suggestions = routineGenerator.generate();
            displaySuggestions(suggestions);
            loadingIndicator.classList.add('hidden');
        }, 50);
    }
    
    function displaySuggestions(suggestions) {
        suggestionsContainer.innerHTML = '';
        if (suggestions.length === 0) {
            suggestionsContainer.innerHTML = '<p>No valid routine combinations found. Please try adjusting your preferences.</p>';
            return;
        }
    
        suggestions.slice(0, 50).forEach((suggestion, index) => {
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            card.innerHTML = `<h3>Suggestion ${index + 1}</h3>
                <div class="suggestion-routine-wrapper">
                    <div class="routine-table" id="rt-wrapper-${index}"></div>
                    <div class="status-table" id="st-wrapper-${index}"></div>
                </div>
                <button class="confirm-btn" id="confirm-btn-${index}">Confirm This Routine</button>`;
            suggestionsContainer.appendChild(card);
            document.getElementById(`rt-wrapper-${index}`).innerHTML = createRoutineTableHTML(`sug-rt-${index}`);
            populateTable(`sug-rt-${index}`, suggestion);
            document.getElementById(`st-wrapper-${index}`).innerHTML = createStatusTableHTML(suggestion);
            document.getElementById(`confirm-btn-${index}`).onclick = () => confirmRoutine(suggestion);
        });
    }

    function confirmRoutine(routine) {
        suggestionsContainer.innerHTML = '';
        finalRoutineContainer.classList.remove('hidden');
        document.getElementById('final-routine-table-wrapper').innerHTML = createRoutineTableHTML('final-routine');
        populateTable('final-routine', routine);
        document.getElementById('final-status-table-wrapper').innerHTML = createStatusTableHTML(routine);
    }

    // --- Event Listeners ---
    themeToggleBtn.addEventListener('click', toggleTheme);
    addCourseBtn.addEventListener('click', () => addCourse(courseSearchInput.value));
    courseSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { addCourse(courseSearchInput.value); courseSearchInput.value = ''; searchSuggestions.classList.add('hidden'); } });
    courseSearchInput.addEventListener('input', handleSearchInput);
    document.addEventListener('click', (e) => { if (!e.target.closest('.course-input-container')) { searchSuggestions.classList.add('hidden'); } });
    generateBtn.addEventListener('click', generateRoutines);
    downloadBtn.addEventListener("click", () => {
        const finalRoutineElement = document.querySelector(".final-routine-wrapper");
        if (finalRoutineElement) {
            html2canvas(finalRoutineElement).then((canvas) => {
                const base64image = canvas.toDataURL("image/png");
                const dlLink = document.createElement('a');
                dlLink.href = base64image;
                dlLink.download = "my_routine.png";
                dlLink.click();
                dlLink.remove();
            });
        }
    });

    initialize();
});

// *** THE AI LOGIC: Rewritten to be simpler and more correct ***
class RoutineGenerator {
    constructor(allCourses, selectedCourseCodes, preferences) {
        this.allCourses = allCourses;
        this.selectedCourseCodes = selectedCourseCodes;
        this.preferences = preferences;
    }

    generate() {
        // Step 1: Filter sections for each course based on preferences
        const filteredCourses = this.selectedCourseCodes.map(code => ({
            code,
            sections: this.allCourses[code].filter(section => this.isSectionValid(section)),
        }));

        // If any course has no valid sections, we cannot proceed.
        if (filteredCourses.some(course => course.sections.length === 0)) {
            console.warn("A course has no sections that match the preferences.");
            return [];
        }

        // Step 2: Use backtracking to find all valid combinations
        const allCombinations = [];
        const backtrack = (courseIndex, currentRoutine) => {
            if (allCombinations.length >= 500) return; // Safety break for performance
            if (courseIndex === filteredCourses.length) {
                allCombinations.push(currentRoutine);
                return;
            }
            const course = filteredCourses[courseIndex];
            for (const section of course.sections) {
                if (!this.hasConflict(currentRoutine, section)) {
                    backtrack(courseIndex + 1, [...currentRoutine, section]);
                }
            }
        };

        backtrack(0, []);
        return this.shuffleArray(allCombinations);
    }

    // Checks if a single section is valid according to user preferences
    isSectionValid(section) {
        const { days, startTime, endTime } = this.preferences;
        const startMins = timeToMinutes(startTime);
        const endMins = timeToMinutes(endTime);

        if (section.times.length === 0) return true; // Always include sections with no times

        return section.times.every(time => {
            const timeStartMins = timeToMinutes(time.startTime);
            const timeEndMins = timeToMinutes(time.endTime);
            if (isNaN(timeStartMins) || isNaN(timeEndMins)) return false; // Skip if time is invalid
            
            const isDayOk = days.includes(time.day);
            const isTimeOk = timeEndMins > startMins && timeStartMins < endMins; // Overlap check
            return isDayOk && isTimeOk;
        });
    }

    // Checks if a new section conflicts with any section already in the routine
    hasConflict(existingRoutine, newSection) {
        for (const existingSection of existingRoutine) {
            for (const timeA of newSection.times) {
                for (const timeB of existingSection.times) {
                    if (timeA.day === timeB.day && Math.max(timeToMinutes(timeA.startTime), timeToMinutes(timeB.startTime)) < Math.min(timeToMinutes(timeA.endTime), timeToMinutes(timeB.endTime))) {
                        return true; // Conflict found
                    }
                }
            }
        }
        return false;
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

// --- UTILITY AND TABLE FUNCTIONS ---
function createRoutineTableHTML(id) {
    const timeSlots = ["08:00 AM-09:20 AM", "09:30 AM-10:50 AM", "11:00 AM-12:20 PM", "12:30 PM-01:50 PM", "02:00 PM-03:20 PM", "03:30 PM-04:50 PM", "05:00 PM-06:20 PM"];
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let tableHTML = `<table id="${id}"><thead><tr><th>Time/Day</th>`;
    days.forEach(day => tableHTML += `<th>${day}</th>`);
    tableHTML += '</tr></thead><tbody>';
    timeSlots.forEach((time, rIndex) => {
        tableHTML += `<tr><td><b>${time}</b></td>`;
        days.forEach((_, cIndex) => tableHTML += `<td id="${id}-${rIndex + 1}-${cIndex + 1}"></td>`);
        tableHTML += '</tr>';
    });
    return tableHTML + '</tbody></table>';
}

function createStatusTableHTML(routine) {
    let tableHTML = `<table><thead><tr><th>Course-Sec</th><th>Faculty</th><th>Seats</th><th>Class Schedule</th></tr></thead><tbody>`;
    routine.forEach(section => {
        const available = section.capacity - section.consumedSeat;
        const seatStatus = available > 0 ? `${available}/${section.capacity}` : `<span style="color: var(--conflict-color); font-weight: bold;">Full</span>`;
        tableHTML += `<tr><td>${section.courseCode}-${section.sectionName}</td><td>${section.faculty}</td><td>${seatStatus}</td><td>${section.rawSchedule || 'N/A'}</td></tr>`;
    });
    return tableHTML + '</tbody></table>';
}

function populateTable(tableId, routine) {
    const grid = document.getElementById(tableId);
    if (!grid) return;
    grid.querySelectorAll('td:not(:first-child)').forEach(td => td.innerHTML = '');
    routine.forEach(section => {
        section.times.forEach(time => {
            getAffectedTimeSlots(time.startTime, time.endTime).forEach(slot => {
                const cellId = getCellId(tableId, time.day, slot);
                if (cellId) {
                    const details = `${section.courseCode}<br><small>${section.sectionName}/${section.faculty}<br>${time.room}</small>`;
                    const cell = document.getElementById(cellId);
                    if (cell) {
                        cell.innerHTML += cell.innerHTML ? `<hr style="border-color: var(--border-color); margin: 2px 0;"><div class="conflict">${details}</div>` : details;
                    }
                }
            });
        });
    });
}

function getAffectedTimeSlots(startTime, endTime) {
    const slots = ["08:00-09:20", "09:30-10:50", "11:00-12:20", "12:30-13:50", "14:00-15:20", "15:30-16:50", "17:00-18:20"];
    const start = timeToMinutes(startTime), end = timeToMinutes(endTime);
    if (isNaN(start) || isNaN(end)) return [];
    return slots.filter(slot => {
        const [slotStart, slotEnd] = slot.split('-').map(timeToMinutes);
        return start < slotEnd && end > slotStart;
    });
}

function getCellId(tableId, day, timeSlot) {
    const timeMap = { "08:00-09:20": 1, "09:30-10:50": 2, "11:00-12:20": 3, "12:30-13:50": 4, "14:00-15:20": 5, "15:30-16:50": 6, "17:00-18:20": 7 };
    const dayMap = { "Sunday": 1, "Monday": 2, "Tuesday": 3, "Wednesday": 4, "Thursday": 5, "Friday": 6, "Saturday": 7 };
    const row = timeMap[timeSlot];
    const col = dayMap[day];
    if (row && col) return `${tableId}-${row}-${col}`;
    return null;
}

function convertTo24Hour(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const lower = timeStr.toLowerCase().trim();
    const match = lower.match(/^(\d{1,2}):(\d{2})\s*(am|pm)/);
    if (!match) return null;
    let [_, hours, minutes, period] = match;
    hours = parseInt(hours, 10);
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
}

function timeToMinutes(time24) {
    if (!time24) return NaN;
    const [h, m] = time24.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return NaN;
    return h * 60 + m;
}

// Final robust parser for schedule strings
function parseScheduleString(scheduleString) {
    if (!scheduleString) return [];
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const timeRegex = /(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i;
    let results = [];
    
    let processedString = scheduleString.replace(/,/g, '|||').replace(/\n/g, '|||');
    days.forEach(day => {
        processedString = processedString.replace(new RegExp(day, 'gi'), `|||${day}`);
    });
    const chunks = processedString.split('|||').filter(s => s.trim());

    chunks.forEach(chunk => {
        const dayMatch = chunk.match(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/i);
        if (!dayMatch) return;
        const day = dayMatch[0].charAt(0).toUpperCase() + dayMatch[0].slice(1).toLowerCase();

        const timeMatch = chunk.match(timeRegex);
        if (!timeMatch) return;
        
        const startTime = convertTo24Hour(timeMatch[1]);
        const endTime = convertTo24Hour(timeMatch[2]);
        if (!startTime || !endTime) return;

        let room = chunk.substring(timeMatch.index + timeMatch[0].length).replace(/^[-\s(),]+|[(),\s]+$/g, '').trim();
        
        results.push({ day, startTime, endTime, room: room || 'N/A' });
    });
    
    return results;
}