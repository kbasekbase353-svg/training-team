// Firebase Configuration & Realtime Synchronization Helper
(function () {
    const firebaseConfig = {
        apiKey: "AIzaSyBU42hEaH3P4JtPrtFRcQWp7OJGVThhDBk",
        authDomain: "trainingsystem-40654.firebaseapp.com",
        databaseURL: "https://trainingsystem-40654-default-rtdb.firebaseio.com",
        projectId: "trainingsystem-40654",
        storageBucket: "trainingsystem-40654.firebasestorage.app",
        messagingSenderId: "585482109860",
        appId: "1:585482109860:web:84c1919b151957792fb731",
        measurementId: "G-NBT98MXM8C"
    };

    let fbApp = null;
    let fbDB = null;
    let isInitialized = false;
    let isSyncingFromCloud = false;

    try {
        if (typeof firebase !== 'undefined') {
            if (!firebase.apps.length) {
                fbApp = firebase.initializeApp(firebaseConfig);
            } else {
                fbApp = firebase.app();
            }
            fbDB = firebase.database();
            isInitialized = true;
            console.log("✅ Firebase Database connected successfully:", firebaseConfig.databaseURL);
        } else {
            console.warn("⚠️ Firebase SDK not loaded, working in offline/localStorage mode.");
        }
    } catch (e) {
        console.error("❌ Firebase init error:", e);
    }

    window.TrainingFirebase = {
        isAvailable() {
            return isInitialized && fbDB !== null;
        },

        getDB() {
            return fbDB;
        },

        // Save a single collection
        async saveCollection(collectionKey, data) {
            if (!this.isAvailable()) return;
            try {
                const cleanData = JSON.parse(JSON.stringify(data));
                await fbDB.ref(collectionKey).set(cleanData);
            } catch (err) {
                console.error(`Error saving ${collectionKey} to Firebase:`, err);
            }
        },

        // Save custom key-value (e.g. updata_account_1, schedule_img_account_1, etc.)
        async saveCustomKey(key, data) {
            if (!this.isAvailable()) return;
            try {
                const safeKey = key.replace(/[.#$[\]]/g, '_');
                const cleanData = data !== undefined && data !== null ? JSON.parse(JSON.stringify(data)) : null;
                await fbDB.ref('customData/' + safeKey).set(cleanData);
            } catch (err) {
                console.error(`Error saving custom key ${key} to Firebase:`, err);
            }
        },

        async removeCustomKey(key) {
            if (!this.isAvailable()) return;
            try {
                const safeKey = key.replace(/[.#$[\]]/g, '_');
                await fbDB.ref('customData/' + safeKey).remove();
            } catch (err) {
                console.error(`Error removing custom key ${key} from Firebase:`, err);
            }
        },

        // Save all core system collections to Firebase
        async saveAll(appInstance) {
            if (!this.isAvailable() || isSyncingFromCloud) return;
            try {
                const payload = {
                    trainers: JSON.parse(JSON.stringify(appInstance.trainers || [])),
                    accounts: JSON.parse(JSON.stringify(appInstance.accounts || [])),
                    leaders: JSON.parse(JSON.stringify(appInstance.leaders || [])),
                    managers: JSON.parse(JSON.stringify(appInstance.managers || [])),
                    videos: JSON.parse(JSON.stringify(appInstance.videos || [])),
                    exams: JSON.parse(JSON.stringify(appInstance.exams || [])),
                    materials: JSON.parse(JSON.stringify(appInstance.materials || [])),
                    adminCreds: JSON.parse(JSON.stringify(appInstance.adminCreds || { user: '0', pass: '0' })),
                    lastUpdated: Date.now()
                };

                await fbDB.ref('systemData').update(payload);
            } catch (err) {
                console.error("Error syncing systemData to Firebase:", err);
            }
        },

        // Initialize Realtime Listeners
        initRealtimeSync(appInstance) {
            if (!this.isAvailable()) return;

            const systemRef = fbDB.ref('systemData');

            // 1. Listen for core system data changes
            systemRef.on('value', (snapshot) => {
                const cloudData = snapshot.val();
                if (!cloudData) {
                    // Cloud is empty on first setup -> auto-migrate existing local data
                    console.log("☁️ First time setup: Migrating local data to Firebase...");
                    this.saveAll(appInstance);
                    return;
                }

                isSyncingFromCloud = true;
                try {
                    let hasChanges = false;

                    if (cloudData.trainers) {
                        appInstance.trainers = Array.isArray(cloudData.trainers) ? cloudData.trainers : Object.values(cloudData.trainers);
                        localStorage.setItem('trainers', JSON.stringify(appInstance.trainers));
                        hasChanges = true;
                    }
                    if (cloudData.accounts) {
                        appInstance.accounts = Array.isArray(cloudData.accounts) ? cloudData.accounts : Object.values(cloudData.accounts);
                        localStorage.setItem('accounts', JSON.stringify(appInstance.accounts));
                        hasChanges = true;
                    }
                    if (cloudData.leaders) {
                        appInstance.leaders = Array.isArray(cloudData.leaders) ? cloudData.leaders : Object.values(cloudData.leaders);
                        localStorage.setItem('leaders', JSON.stringify(appInstance.leaders));
                        hasChanges = true;
                    }
                    if (cloudData.managers) {
                        appInstance.managers = Array.isArray(cloudData.managers) ? cloudData.managers : Object.values(cloudData.managers);
                        localStorage.setItem('managers', JSON.stringify(appInstance.managers));
                        hasChanges = true;
                    }
                    if (cloudData.videos) {
                        appInstance.videos = Array.isArray(cloudData.videos) ? cloudData.videos : Object.values(cloudData.videos);
                        localStorage.setItem('videos', JSON.stringify(appInstance.videos));
                        hasChanges = true;
                    }
                    if (cloudData.exams) {
                        appInstance.exams = Array.isArray(cloudData.exams) ? cloudData.exams : Object.values(cloudData.exams);
                        localStorage.setItem('exams', JSON.stringify(appInstance.exams));
                        hasChanges = true;
                    }
                    if (cloudData.materials) {
                        appInstance.materials = Array.isArray(cloudData.materials) ? cloudData.materials : Object.values(cloudData.materials);
                        localStorage.setItem('materials', JSON.stringify(appInstance.materials));
                        hasChanges = true;
                    }
                    if (cloudData.adminCreds) {
                        appInstance.adminCreds = cloudData.adminCreds;
                        localStorage.setItem('adminCreds', JSON.stringify(appInstance.adminCreds));
                    }

                    // Refresh current UI if active
                    if (hasChanges && typeof appInstance.refreshCurrentView === 'function') {
                        appInstance.refreshCurrentView();
                    }
                } catch (e) {
                    console.error("Error processing cloud update:", e);
                } finally {
                    setTimeout(() => { isSyncingFromCloud = false; }, 300);
                }
            });

            // 2. Listen for customData changes (updata, schedules, etc.)
            const customDataRef = fbDB.ref('customData');
            customDataRef.on('value', (snapshot) => {
                const val = snapshot.val();
                if (val && typeof val === 'object') {
                    for (const safeKey of Object.keys(val)) {
                        localStorage.setItem(safeKey, JSON.stringify(val[safeKey]));
                    }
                    if (typeof appInstance.refreshCurrentView === 'function') {
                        appInstance.refreshCurrentView();
                    }
                }
            });
        }
    };
})();
