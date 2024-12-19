document.addEventListener('DOMContentLoaded', () => {
    // Select all buttons with the "edit-button" class
    const editButtons = document.querySelectorAll('.edit-button');
  
    // Add a click event listener to each button
    editButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Retrieve workout and index from data attributes
        const workout = JSON.parse(button.getAttribute('data-workout'));
        const index = button.getAttribute('data-index');
  
        // Pass the data to the popup function
        openWorkoutPopup(workout, index);
      });
    });
  
    // Add event listener for "Add Workout" button
    const addButton = document.querySelector('.add-workout-button');
    if (addButton) {
      addButton.addEventListener('click', () => {
        openWorkoutPopup(null, null);
      });
    }
  });
  
  // Open popup function
  function openWorkoutPopup(workout, index) {
    console.log('Opening popup with workout:', workout, 'at index:', index);
  
    // Update the popup title
    document.getElementById('popupTitle').innerText = index !== undefined ? 'Edit Workout' : 'Add Workout';
  
    // Populate fields if editing a workout
    if (workout) {
      document.getElementById('type').value = workout.type || '';
      document.getElementById('duration').value = workout.duration || '';
      document.getElementById('calories').value = workout.calories || '';
      document.getElementById('date').value = workout.date 
        ? new Date(workout.date).toISOString().split('T')[0] 
        : '';
      document.getElementById('workoutIndex').value = index;
    } else {
      // Clear fields if adding a new workout
      document.getElementById('workoutForm').reset();
      document.getElementById('workoutIndex').value = '';
    }
  
    // Show the popup
    document.getElementById('workoutPopup').classList.remove('hidden');
  }
  
  // Close popup function
  function closeWorkoutPopup() {
    console.log('Closing popup');
  
    // Hide the popup
    document.getElementById('workoutPopup').classList.add('hidden');
  }
  