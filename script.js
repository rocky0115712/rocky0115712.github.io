/**
 * Coro Forza Portal Script
 * Handles UI interactions and LocalStorage data management.
 */

// Data Management Class
class DataManager {
    static STORAGE_KEY_SCHEDULE = 'coro_schedule';
    static STORAGE_KEY_ATTENDANCE = 'coro_attendance';
    static STORAGE_KEY_MEMBERS = 'coro_members';

    // -- Schedule --
    static getSchedule() {
        const data = localStorage.getItem(this.STORAGE_KEY_SCHEDULE);
        if (data) return JSON.parse(data);

        // Default Initial Data if empty
        const initial = [
            { date: '2024.05.18 (土)', time: '13:00 - 17:00', location: '市民ホール 練習室1', tag: '通常練習' },
            { date: '2024.05.25 (土)', time: '13:00 - 17:00', location: '文化センター リハーサル室', tag: '強化練習' },
            { date: '2024.06.01 (土)', time: '13:00 - 17:00', location: '市民ホール 練習室1', tag: '通常練習' }
        ];
        this.saveSchedule(initial);
        return initial;
    }

    static saveSchedule(data) {
        localStorage.setItem(this.STORAGE_KEY_SCHEDULE, JSON.stringify(data));
    }

    // -- Attendance --
    // Format: { "MemberName_DateString": "Status" } -> Status: 'O', 'X', 'T', '-'
    static getAttendance() {
        const data = localStorage.getItem(this.STORAGE_KEY_ATTENDANCE);
        return data ? JSON.parse(data) : {};
    }

    static updateAttendance(key, status) {
        const data = this.getAttendance();
        data[key] = status;
        localStorage.setItem(this.STORAGE_KEY_ATTENDANCE, JSON.stringify(data));
    }

    // -- Members --
    // Format: [ { name: "Name", part: "S"|"A"|"T"|"B" } ]
    // -- Members --
    // Format: [ { name: "Name", part: "S"|"A"|"T"|"B" } ]
    static getMembers() {
        const data = localStorage.getItem(this.STORAGE_KEY_MEMBERS);
        if (data) {
            let parsed = JSON.parse(data);
            // Migration: Convert strings to objects
            let needsSave = false;
            const migrated = parsed.map(m => {
                if (typeof m === 'string') {
                    needsSave = true;
                    return { name: m, part: 'S' }; // Default to Soprano
                }
                return m;
            });

            if (needsSave) {
                this.saveMembers(migrated);
            }
            return migrated;
        }

        // Default Members with Parts
        const initial = [
            { name: '佐藤 花子', part: 'S' },
            { name: '鈴木 明子', part: 'S' },
            { name: '田中 美咲', part: 'A' },
            { name: '高橋 優子', part: 'A' },
            { name: '加藤 健太', part: 'T' },
            { name: '渡辺 浩二', part: 'T' },
            { name: '伊藤 博文', part: 'B' },
            { name: '山本 太郎', part: 'B' }
        ];
        this.saveMembers(initial);
        return initial;
    }

    static saveMembers(data) {
        localStorage.setItem(this.STORAGE_KEY_MEMBERS, JSON.stringify(data));
    }

    // New Helper: Get members present/tentative on a date grouped by part
    static getAttendeesByDate(date) {
        const members = this.getMembers();
        const attendance = this.getAttendance();
        const result = {
            O: { S: [], A: [], T: [], B: [] }, // Present
            T: { S: [], A: [], T: [], B: [] }  // Tentative
        };

        members.forEach(m => {
            const key = `${m.name}_${date}`;
            const status = attendance[key];

            if (status === 'O') {
                if (result.O[m.part]) result.O[m.part].push(m.name);
            } else if (status === 'T') {
                if (result.T[m.part]) result.T[m.part].push(m.name);
            }
        });
        return result;
    }

    // Delete Member
    static deleteMember(name) {
        const members = this.getMembers().filter(m => m.name !== name);
        this.saveMembers(members);

        // Also cleanup attendance records for this member
        const attendance = this.getAttendance();
        Object.keys(attendance).forEach(key => {
            if (key.startsWith(name + '_')) {
                delete attendance[key];
            }
        });
        localStorage.setItem(this.STORAGE_KEY_ATTENDANCE, JSON.stringify(attendance));
    }
}

// UI Interaction
document.addEventListener('DOMContentLoaded', () => {
    // Scroll Header Effect
    const header = document.getElementById('header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // Mobile Menu
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const mobileNav = document.querySelector('.mobile-nav');
    const mobileLinks = document.querySelectorAll('.mobile-nav a');
    let isMenuOpen = false;

    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            isMenuOpen = !isMenuOpen;
            if (isMenuOpen) {
                mobileNav.classList.add('active');
                menuBtn.innerHTML = '<i data-lucide="x"></i>';
            } else {
                mobileNav.classList.remove('active');
                menuBtn.innerHTML = '<i data-lucide="menu"></i>';
            }
            if (window.lucide) lucide.createIcons();
        });

        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                isMenuOpen = false;
                mobileNav.classList.remove('active');
                menuBtn.innerHTML = '<i data-lucide="menu"></i>';
                if (window.lucide) lucide.createIcons();
            });
        });
    }

    // Render Schedule on Home Page
    const scheduleList = document.getElementById('schedule-list');
    if (scheduleList) {
        const data = DataManager.getSchedule();
        if (data.length === 0) {
            scheduleList.innerHTML = '<div class="schedule-item" style="justify-content:center">予定はありません</div>';
        } else {
            scheduleList.innerHTML = data.map((item, index) => `
                <div class="schedule-item" onclick="openScheduleModal('${item.date}', '${item.location}', '${item.tag}')" style="cursor: pointer; transition: background 0.2s;">
                    <div class="date"><i data-lucide="calendar" class="text-primary"></i> ${item.date}</div>
                    <div class="time">${item.time}</div>
                    <div class="location">${item.location}</div>
                    <div class="tag">${item.tag}</div>
                </div>
            `).join('');
            if (window.lucide) lucide.createIcons();
        }
    }

    // Modal Logic
    const modal = document.getElementById('schedule-modal');
    const closeBtn = document.querySelector('.modal-close');

    if (modal && closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    window.openScheduleModal = (date, location, tag) => {
        const modal = document.getElementById('schedule-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        if (modal && title && body) {
            title.textContent = `${date} (${tag})`;

            const attendeesData = DataManager.getAttendeesByDate(date);
            const partNames = { S: 'Soprano', A: 'Alto', T: 'Tenor', B: 'Bass' };
            const parts = ['S', 'A', 'T', 'B'];

            let html = `<p style="margin-bottom:1rem; color:gray;"><i data-lucide="map-pin" style="width:16px; display:inline-block; vertical-align:middle;"></i> ${location}</p>`;

            // --- Present (O) ---
            html += '<h3 style="border-bottom:3px solid #10b981; padding-bottom:0.5rem; margin-bottom:1rem; color:#065f46;">出席 (◯)</h3>';
            let totalO = 0;
            parts.forEach(p => {
                const list = attendeesData.O[p];
                totalO += list.length;
                if (list.length > 0) {
                    html += `<div style="margin-bottom:0.5rem;"><strong>${partNames[p]}</strong> <span style="font-size:0.9em;color:gray;">(${list.length})</span>: ${list.join('　')}</div>`;
                }
            });
            html += `<div style="margin-top:0.5rem; text-align:right; font-weight:bold; color:#065f46;">出席合計: ${totalO}名</div>`;

            // --- Tentative (T) ---
            html += '<h3 style="border-bottom:3px solid #f59e0b; padding-bottom:0.5rem; margin:1.5rem 0 1rem 0; color:#92400e;">未定 (△)</h3>';
            let totalT = 0;
            parts.forEach(p => {
                const list = attendeesData.T[p];
                totalT += list.length;
                if (list.length > 0) {
                    html += `<div style="margin-bottom:0.5rem;"><strong>${partNames[p]}</strong> <span style="font-size:0.9em;color:gray;">(${list.length})</span>: ${list.join('　')}</div>`;
                }
            });
            if (totalT === 0) html += '<p style="color:#ccc;">該当者なし</p>';

            body.innerHTML = html;
            modal.classList.add('active');
            if (window.lucide) lucide.createIcons();
        }
    };

    // Intersection Observer for Animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const animatedElements = document.querySelectorAll('.fade-in-up');
    animatedElements.forEach(el => observer.observe(el));
});
