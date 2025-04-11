import { useEffect, useState } from 'react';
import { onMessageListener, requestNotificationPermission } from '../config/firebase';
import toast from 'react-hot-toast';
import { supabase } from '../config/supabaseClient';

export const useNotifications = () => {
  const [notification, setNotification] = useState({ title: '', body: '' });
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);

  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        const token = await requestNotificationPermission();
        setIsPermissionGranted(true);
        // Here you would typically send this token to your backend
        console.log('FCM Token:', token);
        // send token and set it in the user profile in supabase with key fcmToken
        //const { data, error } = await supabase.from('profiles').update({ fcmToken: token }).eq('id', user.id);
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
        setIsPermissionGranted(false);
      }
    };

    initializeNotifications();
  }, []);

  useEffect(() => {
    const unsubscribe = onMessageListener()
      .then((payload: any) => {
        setNotification({
          title: payload?.notification?.title,
          body: payload?.notification?.body,
        });
        
        // Show toast notification
        toast.custom((t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {payload?.notification?.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {payload?.notification?.body}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ));
      })
      .catch((err) => console.error('Failed to receive foreground message:', err));

    return () => {
      unsubscribe;
    };
  }, []);

  return {
    notification,
    isPermissionGranted,
  };
}; 