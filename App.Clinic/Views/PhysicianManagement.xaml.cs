using App.Clinic.ViewModels;
using System.ComponentModel;

namespace App.Clinic.Views;

public partial class PhysicianManagement : ContentPage, INotifyPropertyChanged
{

    public PhysicianManagement()
    {
        InitializeComponent();
        BindingContext = new PhysiciantManagementViewModel();
    }

    private void CancelClicked(object sender, EventArgs e)
    {
        Shell.Current.GoToAsync("//MainPage");
    }

    private void AddClicked(object sender, EventArgs e)
    {
        // Navigate to PhysicianDetails for adding a new physician
        Shell.Current.GoToAsync("//PhysicianDetails?physicianId=0");
    }

    private void EditClicked(object sender, EventArgs e)
    {
        // Pass the selected physician's License for editing
        var selectedPhysicianLicense = (BindingContext as PhysiciantManagementViewModel)?
            .SelectedPhysician?.License ?? "";
        Shell.Current.GoToAsync($"//PhysicianDetails?license={selectedPhysicianLicense}");
    }

    private void DeleteClicked(object sender, EventArgs e)
    {
        (BindingContext as PhysiciantManagementViewModel)?.Delete();
    }

    private void PhysicianManagement_NavigatedTo(object sender, NavigatedToEventArgs e)
    {
        (BindingContext as PhysiciantManagementViewModel)?.Refresh();
    }
}