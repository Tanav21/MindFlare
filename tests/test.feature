Feature: Book Consultation


    Scenario: New user is able to book appointment sucessfully
    Given I have launched the telehealth application in my web browser
    And I register as new patient with below details
    | FirstName              | LastName        | Email                           | Phone              | Password | DateOfBirth | MedicalHistory |
    | Tanav                  |  Mahendru       |  tanavmahendru@gmail.com        | 9135785789         | 123456   | 04/10/2020  | Prediabitic    |
    And I see the message displayed as "No appointments yet. Book your first consultation!"
    When I click on book new appointment
    And I select the speciality as "General Practice"
    And I select the doctor "Dr. prasum dubey" for my appointment
    And I select the date and time as "01/21/2026" and "08:27 PM" respectivly
    And I click on proceed to payment
    And I submit the card details on Complete Payment page
    | CardNumber            |ExpiryDate| CVV | Pincode|
    | 4111 1111 1111 1111   | 12/26    |686  | 89284  |
    Then I can sucessfully see my appointment booked on the yours appointment page
    | DoctorName             | Speciality        | DateAndTime         | AppointmentStatus| PaymentStatus |
    | Dr. prasum dubey       |  General Practice | 21/01/2026, 20:27:00| Confirmed        | paid          |



    Scenario: Existing user is able to book appointment sucessfully
    Given I have launched the telehealth application in my web browser
    And I have logged in sucessfully with below credentials
    | Email             | Password|
    | patient@gmail.com | 123456  |
    When I click on book new appointment
    And I select the speciality as "General Practice"
    And I select the doctor "Dr. prasum dubey" for my appointment
    And I select the date and time as "01/21/2026" and "08:27 PM" respectivly
    And I click on proceed to payment
    And I submit the card details on Complete Payment page
    | CardNumber            |ExpiryDate| CVV | Pincode|
    | 4111 1111 1111 1111  | 12/26    |686  | 89284  |
    Then I can sucessfully see my appointment booked on the yours appointment page
    | DoctorName             | Speciality        | DateAndTime         | AppointmentStatus| PaymentStatus |
    | Dr. prasum dubey       |  General Practice | 21/01/2026, 20:27:00| Confirmed        | paid          |



    Scenario: User is able to attend the booked consultation on scheduled date and time
    Given Patient have launched the telehealth application in my web browser
    And Patient can see the booked appointments 
    When Patient clicks on start consultation
    Then The video consultation session is started with the scheduled doctor
    And Patient and doctor are able to communicate over the chat during the session from chat window
    And  Patient and doctor can share the medical/supported documents with each other within the session
    And Patient and doctor can see the transcription of the conversation during the session

     
    Scenario: Verify the application is able to overcome challenges of difference in dialect/ accent in remote consultation via a transcription service
    Given Patient and doctor are connected with each other over video session on telehealth application
    When Patient or doctor communicate via audio in different dialects
    Then The transcription coloumn shows the transcripted version of audio communication during the session


    Scenario: Patient is able to access the consultation report generated via transcription of the session
    Given I have already attended the consultation session with doctor
    And I can successfully see the completed sessions on your appointment page
    When I click on Show Consultation Details of completed session
    Then I can see the consultation report generated from the transcription of the online session with details like "Consultation Summary","Key Symptoms","Doctor Observations", "Advice/ Treatment"," Follow-up Recommendation"
