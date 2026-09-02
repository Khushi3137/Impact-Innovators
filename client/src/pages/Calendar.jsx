const Calendar = () => {
  return (
    /* 1. Added dark:bg-gray-800 and dark:border-gray-700 to the container */
    <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
      
      {/* 2. Header remains fixed with dark:text-white */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Calendar
      </h1>

      {/* 3. Added dark:text-gray-400 to make this text visible */}
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Calendar integration coming soon...
      </p>

    </div>
  );
};

export default Calendar;