using Library.Clinic.Models;
using Library.Clinic.Services;

namespace App.Clinic.Views;

[QueryProperty(nameof(PhysicianLicense), "physicianLicense")]
public partial class PhysicianView : ContentPage
{
    public PhysicianView()
    {
        InitializeComponent();
        BindingContext = new Physician();
    }

    public string PhysicianLicense { get; set; }

    private void CancelClicked(object sender, EventArgs e)
    {
        Shell.Current.GoToAsync("//Physicians");
    }

    private void AddClicked(object sender, EventArgs e)
    {
        var physicianToAdd = BindingContext as Physician;
        if (physicianToAdd != null)
        {
            // Add or update physician using the service
            PhysicianServiceProxy
                .Current
                .AddOrUpdatePhysician(physicianToAdd);
        }

        // Navigate back to the Physicians page
        Shell.Current.GoToAsync("//Physicians");
    }

    private void PhysicianView_NavigatedTo(object sender, NavigatedToEventArgs e)
    {
        // Check if a PhysicianLicense is provided for editing
        if (!string.IsNullOrEmpty(PhysicianLicense))
        {
            // Fetch the physician data and set it to BindingContext for editing
            BindingContext = PhysicianServiceProxy.Current
                .Physicians.FirstOrDefault(p => p.License == PhysicianLicense);
        }
        else
        {
            // Reset form fields for adding a new physician
            BindingContext = new Physician();
        }
    }
}