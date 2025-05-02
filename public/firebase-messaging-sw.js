// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here. Other Firebase libraries
// are not available in the service worker.
importScripts(
	"https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"
);
importScripts(
	"https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js"
);

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config-object
firebase.initializeApp({
	apiKey: "AIzaSyDFBJf85Sz4RMZrjAbcbI4bMJajgglZFTY",
	authDomain: "farkle-4ff88.firebaseapp.com",
	projectId: "farkle-4ff88",
	storageBucket: "farkle-4ff88.firebasestorage.app",
	messagingSenderId: "360100446460",
	appId: "1:360100446460:web:2ff8026c1d9dd4ff641779",
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
	console.log(
		"[firebase-messaging-sw.js] Received background message ",
		payload
	);

	// Customize notification here
	const notificationTitle = payload.notification.title;
	const notificationOptions = {
		body: payload.notification.body + " test",
		icon: "/icons/icon-192x192.svg",
	};
	debugger;
	self.registration.showNotification(notificationTitle, notificationOptions);
});
