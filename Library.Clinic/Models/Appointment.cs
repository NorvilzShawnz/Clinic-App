﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
namespace Library.Clinic.Models
{
    public class Appointment
    {
        public Appointment() { }
        public int Id { get; set; }
        public DateTime? StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public int PatientId { get; set; }
        public Patient? Patient { get; set; }
        public Patient? PatientName { get; set; }
    }
}